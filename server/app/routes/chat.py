"""
POST /api/chat — conversational RAG endpoint (Server-Sent Events).

Streams LLM tokens back to the client as SSE events using FastAPI's
StreamingResponse. Each event is a JSON payload with a "type" field:
  - {"type": "token",   "content": "..."}   — a single streamed token
  - {"type": "sources", "documents": [...]} — source citations (end of stream)
  - {"type": "error",   "content": "..."}   — error during generation
  - [DONE]                                  — terminal sentinel
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.models import ChatRequest
from app.services.rag_chain import stream_rag_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/chat",
    summary="Chat with documents via streaming SSE",
    response_description="Server-Sent Events stream of tokens and sources",
)
async def chat(
    request: ChatRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> StreamingResponse:
    """
    Send a message and receive a streaming AI response grounded in uploaded documents.

    The response is a text/event-stream of JSON-encoded events. Use an
    SSE-capable client (EventSource, fetch with ReadableStream) to consume it.
    """
    logger.info(
        "Chat request — session=%s, message=%.80s...",
        request.session_id,
        request.message,
    )

    return StreamingResponse(
        stream_rag_response(request.message, request.session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Disable Nginx buffering when behind proxy
            "Connection": "keep-alive",
        },
    )


import os
import json
from uuid import uuid4

@router.get("/chat/sessions", summary="List all active chat sessions")
async def list_sessions(settings: Annotated[Settings, Depends(get_settings)]):
    sessions_dir = settings.sessions_dir
    os.makedirs(sessions_dir, exist_ok=True)
    sessions = []
    for filename in os.listdir(sessions_dir):
        if filename.endswith(".json"):
            path = os.path.join(sessions_dir, filename)
            mtime = os.path.getmtime(path)
            
            session_id = filename[:-5]
            title = f"Session {session_id[:6]}..."
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        if item.get("type") == "human":
                            content = item.get("data", {}).get("content", "").strip()
                            if content:
                                title = content[:30] + ("..." if len(content) > 30 else "")
                            break
            except Exception:
                pass

            sessions.append({
                "id": session_id,
                "title": title,
                "mtime": mtime
            })
    sessions.sort(key=lambda x: x["mtime"], reverse=True)
    return {"sessions": [{"id": s["id"], "title": s["title"]} for s in sessions]}


@router.get("/chat/sessions/{session_id}", summary="Get history for a session")
async def get_session_history_endpoint(session_id: str, settings: Annotated[Settings, Depends(get_settings)]):
    safe_session_id = "".join(c for c in session_id if c.isalnum() or c in ("-", "_"))
    file_path = os.path.join(settings.sessions_dir, f"{safe_session_id}.json")
    
    if not os.path.exists(file_path):
        return {"messages": []}
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        messages = []
        for item in data:
            msg_type = item.get("type")
            content = item.get("data", {}).get("content", "")
            if msg_type not in ["human", "ai"]:
                continue
                
            messages.append({
                "id": str(uuid4()),
                "role": "user" if msg_type == "human" else "ai",
                "content": content
            })
        return {"messages": messages}
    except Exception as e:
        logger.error(f"Error reading session {session_id}: {e}")
        return {"messages": []}


@router.delete("/chat/sessions/{session_id}", summary="Delete a chat session and its documents")
async def delete_session(session_id: str, settings: Annotated[Settings, Depends(get_settings)]):
    """
    Delete a chat session completely:
    1. Removes the session history JSON file
    2. Deletes all ChromaDB vectors scoped to this session
    3. Removes document registry entries for this session
    """
    from app.services.rag_chain import clear_session
    from app.services.vector_store import get_vector_store

    safe_session_id = "".join(c for c in session_id if c.isalnum() or c in ("-", "_"))

    # 1. Delete session history file
    file_path = os.path.join(settings.sessions_dir, f"{safe_session_id}.json")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            clear_session(safe_session_id)
            logger.info("Deleted session history: %s", safe_session_id)
        except OSError as e:
            logger.warning("Could not delete session file %s: %s", file_path, e)

    # 2. Delete all vectors associated with this session
    try:
        store = get_vector_store()
        store._collection.delete(where={"session_id": safe_session_id})
        logger.info("Deleted vectors for session: %s", safe_session_id)
    except Exception as e:
        logger.warning("Could not delete vectors for session %s: %s", safe_session_id, e)

    # 3. Remove document registry entries for this session
    registry_path = os.path.join(settings.upload_dir, "documents.json")
    if os.path.exists(registry_path):
        try:
            with open(registry_path, "r", encoding="utf-8") as f:
                registry = json.load(f)
            updated = [doc for doc in registry if doc.get("session_id") != safe_session_id]
            if len(updated) != len(registry):
                with open(registry_path, "w", encoding="utf-8") as f:
                    json.dump(updated, f, indent=2, ensure_ascii=False)
                logger.info(
                    "Removed %d document registry entries for session: %s",
                    len(registry) - len(updated), safe_session_id
                )
        except Exception as e:
            logger.warning("Could not clean up registry for session %s: %s", safe_session_id, e)

    return {"status": "ok"}
