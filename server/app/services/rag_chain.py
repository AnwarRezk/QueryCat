"""
RAG chain service — the core AI pipeline.

Architecture:
  1. history_aware_retriever  — condenses follow-up questions into standalone queries
  2. stuff_documents_chain    — formats retrieved chunks + history into the LLM prompt
  3. retrieval_chain          — orchestrates retriever → documents → LLM
  4. In-memory session store  — keeps last N messages per session_id

Streaming is done via LangChain's .astream_events() method, which emits
individual token events that we forward as SSE data frames.
"""
import json
import logging
import os
from collections import defaultdict
from typing import AsyncGenerator

from langchain_classic.chains import create_history_aware_retriever, create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, messages_from_dict, messages_to_dict
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.config import get_settings
from app.services.llm_provider import get_llm
from app.services.vector_store import get_retriever

logger = logging.getLogger(__name__)

# ── Persistent json conversation store ────────────────────────────────────────
def _get_session_file_path(session_id: str) -> str:
    settings = get_settings()
    # basic sanitize
    safe_session_id = "".join(c for c in session_id if c.isalnum() or c in ("-", "_"))
    return os.path.join(settings.sessions_dir, f"{safe_session_id}.json")


def get_session_history(session_id: str) -> list[BaseMessage]:
    """Return the message history for a given session from disk."""
    settings = get_settings()
    file_path = _get_session_file_path(session_id)
    history = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            history = messages_from_dict(data)
        except Exception:
            logger.exception("Failed to load history for %s", session_id)
            
    # Keep only the last N messages to avoid context bloat
    max_msgs = settings.max_history_messages
    if len(history) > max_msgs:
        history = history[-max_msgs:]
    return history


def update_session_history(
    session_id: str, human_msg: str, ai_msg: str
) -> None:
    """Append a human/AI turn to the session history and save to disk."""
    history = get_session_history(session_id)
    history.append(HumanMessage(content=human_msg))
    history.append(AIMessage(content=ai_msg))
    
    file_path = _get_session_file_path(session_id)
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(messages_to_dict(history), f, ensure_ascii=False, indent=2)
    except Exception:
        logger.exception("Failed to save history for %s", session_id)


def clear_session(session_id: str) -> None:
    """Clear the conversation history for a session by deleting the file."""
    file_path = _get_session_file_path(session_id)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass


# ── Prompt templates ──────────────────────────────────────────────────────────

# Rephrases follow-up questions into self-contained queries for the retriever
_CONDENSE_PROMPT = ChatPromptTemplate.from_messages(
    [
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        (
            "human",
            "Given the conversation above, rephrase the follow-up question into a "
            "standalone question that can be understood without the conversation context. "
            "Do NOT answer the question, only reformulate it if needed. "
            "If the question is already standalone, return it as-is.",
        ),
    ]
)

# Main QA prompt — handles general chat, document Q&A, and cross-document comparison
_QA_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are DocChat, a helpful and expert AI assistant.
You can answer general questions as well as questions about uploaded documents.

Rules:
- If the user asks about the uploaded documents, refer to the Context from documents below.
- When multiple documents are present in the context, you can compare, contrast,
  and cross-reference them. Clearly label which document each point comes from.
- Always cite the source filename when referencing document content.
- If the context does not contain the answer, or if the user asks a general question,
  answer naturally using your own knowledge.
- Be concise, clear, and well-structured. Use markdown formatting when helpful.
- For comparison requests, use structured formats like tables or bullet lists.

Context from documents:
{context}""",
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
    ]
)


def _build_chain(session_id: str | None = None):
    """Build and return the full conversational retrieval chain."""
    settings = get_settings()
    llm = get_llm()
    retriever = get_retriever(k=settings.retrieval_k, session_id=session_id)

    # Step 1: History-aware retriever — rephrases follow-ups
    history_aware_retriever = create_history_aware_retriever(
        llm, retriever, _CONDENSE_PROMPT
    )

    # Step 2: Document combination chain — formats context into LLM prompt
    # Specific tag for the final answer stage
    document_chain = create_stuff_documents_chain(llm, _QA_PROMPT).with_config({"tags": ["final_answer"]})

    # Step 3: Full retrieval chain
    return create_retrieval_chain(history_aware_retriever, document_chain)


async def stream_rag_response(
    message: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    """
    Stream tokens from the RAG chain as SSE-formatted data strings.
    Retrieval is scoped to documents belonging to this session_id.

    Yields:
        SSE lines in the format:
          data: {"type": "token",   "content": "..."}
          data: {"type": "sources", "documents": [...]}
          data: [DONE]
    """
    chain = _build_chain(session_id=session_id)
    history = get_session_history(session_id)

    full_response = ""
    source_docs = []

    try:
        # astream_events v2 emits fine-grained events per chain node
        async for event in chain.astream_events(
            {"input": message, "chat_history": history},
            version="v2",
        ):
            kind = event.get("event")
            name = event.get("name", "")

            # ── Capture source documents from retriever ──────────────────
            if kind == "on_retriever_end":
                docs = event.get("data", {}).get("output", {})
                if isinstance(docs, list):
                    source_docs = [
                        {
                            "source": doc.metadata.get("source", "Unknown"),
                            "page": doc.metadata.get("page", 0),
                            "chunk_index": doc.metadata.get("chunk_index", 0),
                            "content_preview": doc.page_content[:200],
                        }
                        for doc in docs
                    ]

            # ── Stream LLM tokens (Only from the final answer stage) ─────
            if kind == "on_chat_model_stream":
                if "final_answer" in event.get("tags", []):
                    chunk = event.get("data", {}).get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        full_response += chunk.content
                        payload = json.dumps({"type": "token", "content": chunk.content})
                        yield f"data: {payload}\n\n"

        # ── Send source documents after streaming finishes ───────────────
        if source_docs:
            sources_payload = json.dumps({"type": "sources", "documents": source_docs})
            yield f"data: {sources_payload}\n\n"

        # ── Persist the completed turn to session history ────────────────
        if full_response:
            update_session_history(session_id, message, full_response)

        yield "data: [DONE]\n\n"

    except Exception as exc:
        logger.exception("Error during RAG streaming for session %s", session_id)
        error_payload = json.dumps(
            {"type": "error", "content": f"An error occurred: {str(exc)}"}
        )
        yield f"data: {error_payload}\n\n"
        yield "data: [DONE]\n\n"
