"""
GET /api/documents — list ingested documents, optionally filtered by session.

Reads the metadata registry written by the upload route and returns
a structured list of documents. Supports filtering by session_id so the
sidebar can show only the files attached to the current conversation.
"""
import json
import logging
import os
from typing import Annotated, Optional

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.models import DocumentInfo, DocumentListResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List ingested documents, optionally filtered by session",
)
async def list_documents(
    settings: Annotated[Settings, Depends(get_settings)],
    session_id: Optional[str] = None,
) -> DocumentListResponse:
    """
    Return metadata for ingested documents.

    - If session_id is provided, only documents belonging to that session are returned.
    - If session_id is omitted, all documents are returned (global list).
    """
    registry_path = os.path.join(settings.upload_dir, "documents.json")

    if not os.path.exists(registry_path):
        return DocumentListResponse(documents=[], total=0)

    with open(registry_path, "r", encoding="utf-8") as f:
        raw: list[dict] = json.load(f)

    # Filter by session_id if provided
    if session_id:
        raw = [doc for doc in raw if doc.get("session_id") == session_id]

    documents = [
        DocumentInfo(
            id=doc["id"],
            filename=doc["filename"],
            uploaded_at=doc["uploaded_at"],
            chunk_count=doc["chunk_count"],
            size_bytes=doc.get("size_bytes", 0),
            file_type=doc.get("file_type"),
            session_id=doc.get("session_id"),
        )
        for doc in raw
    ]

    return DocumentListResponse(documents=documents, total=len(documents))


@router.delete(
    "/documents/{document_id}",
    summary="Delete a specific document from the knowledge base",
)
async def delete_document(
    document_id: str,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """
    Remove a document from:
    1. The document metadata registry
    2. ChromaDB (all chunks with matching upload_id)
    """
    from app.services.vector_store import get_vector_store

    # 1. Remove from registry
    registry_path = os.path.join(settings.upload_dir, "documents.json")
    found = False
    if os.path.exists(registry_path):
        with open(registry_path, "r", encoding="utf-8") as f:
            registry = json.load(f)
        updated = [doc for doc in registry if doc.get("id") != document_id]
        found = len(updated) < len(registry)
        if found:
            with open(registry_path, "w", encoding="utf-8") as f:
                json.dump(updated, f, indent=2, ensure_ascii=False)
            logger.info("Removed document %s from registry", document_id)

    # 2. Remove vectors from ChromaDB
    try:
        store = get_vector_store()
        store.delete(where={"upload_id": document_id})
        logger.info("Removed vectors for document %s from ChromaDB", document_id)
    except Exception as e:
        logger.warning("Could not remove vectors for document %s: %s", document_id, e)

    return {"status": "ok", "deleted": found}

