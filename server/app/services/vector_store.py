"""
ChromaDB vector store service (persistent local mode).

Uses LangChain's Chroma integration with a local persistent directory,
so no Docker or external server is required.
Collection name: "documents" — all uploaded PDFs share one collection,
distinguished by metadata (source filename, upload_id).
"""
import logging
from functools import lru_cache
from typing import Any

from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.config import get_settings
from app.services.embeddings import get_embeddings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "documents"


@lru_cache(maxsize=1)
def get_vector_store() -> Chroma:
    """
    Return a cached singleton Chroma vector store with persistent local storage.
    The persist directory is created automatically if it does not exist.
    """
    settings = get_settings()
    logger.info(
        "Initialising ChromaDB at: %s (collection: %s)",
        settings.chroma_persist_dir,
        COLLECTION_NAME,
    )
    store = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=get_embeddings(),
        persist_directory=settings.chroma_persist_dir,
    )
    logger.info("ChromaDB ready.")
    return store


async def add_documents(documents: list[Document]) -> int:
    """
    Embed and upsert a list of LangChain Documents into the vector store.

    Returns the number of documents added.
    """
    store = get_vector_store()
    # Chroma's add_documents is synchronous; run via executor in production,
    # but acceptable here as it is called once per upload.
    ids = store.add_documents(documents)
    logger.info("Added %d chunks to vector store.", len(ids))
    return len(ids)


async def similarity_search(
    query: str,
    k: int = 4,
    filter: dict[str, Any] | None = None,
) -> list[Document]:
    """
    Retrieve the top-k most relevant document chunks for a query.

    Args:
        query: The user's question.
        k: Number of chunks to retrieve.
        filter: Optional ChromaDB metadata filter dict.

    Returns:
        List of LangChain Document objects with page_content and metadata.
    """
    store = get_vector_store()
    results = store.similarity_search(query, k=k, filter=filter)
    logger.debug("Retrieved %d chunks for query.", len(results))
    return results


def get_retriever(k: int = 4):
    """Return a LangChain retriever interface for the vector store."""
    store = get_vector_store()
    return store.as_retriever(search_kwargs={"k": k})
