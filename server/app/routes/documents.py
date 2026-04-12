"""
GET /api/documents — list all ingested documents.

Reads the metadata registry written by the upload route and returns
a structured list of all documents that have been processed into the
vector database.
"""
import json
import logging
import os
from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.models import DocumentInfo, DocumentListResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List all ingested documents",
)
async def list_documents(
    settings: Annotated[Settings, Depends(get_settings)],
) -> DocumentListResponse:
    """
    Return metadata for all documents that have been uploaded and ingested.
    """
    registry_path = os.path.join(settings.upload_dir, "documents.json")

    if not os.path.exists(registry_path):
        return DocumentListResponse(documents=[], total=0)

    with open(registry_path, "r", encoding="utf-8") as f:
        raw: list[dict] = json.load(f)

    documents = [
        DocumentInfo(
            id=doc["id"],
            filename=doc["filename"],
            uploaded_at=doc["uploaded_at"],
            chunk_count=doc["chunk_count"],
            size_bytes=doc.get("size_bytes", 0),
        )
        for doc in raw
    ]

    return DocumentListResponse(documents=documents, total=len(documents))
