"""
POST /api/upload — PDF ingestion endpoint.

Accepts a multipart/form-data PDF file, processes it into chunks,
embeds them, stores in ChromaDB, and persists metadata for listing.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Annotated

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from app.config import Settings, get_settings
from app.models import UploadResponse
from app.services.pdf_processor import process_pdf
from app.services.vector_store import add_documents

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"application/pdf"}
MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def _get_documents_registry_path(settings: Settings) -> str:
    """Return the path to the JSON metadata file."""
    return os.path.join(settings.upload_dir, "documents.json")


def _load_registry(settings: Settings) -> list[dict]:
    """Load the documents metadata registry from disk."""
    registry_path = _get_documents_registry_path(settings)
    if not os.path.exists(registry_path):
        return []
    with open(registry_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_registry(settings: Settings, registry: list[dict]) -> None:
    """Persist the documents metadata registry to disk."""
    registry_path = _get_documents_registry_path(settings)
    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a PDF document",
)
async def upload_document(
    file: UploadFile,
    settings: Annotated[Settings, Depends(get_settings)],
) -> UploadResponse:
    """
    Upload a PDF file for ingestion into the vector database.

    - Validates file type (PDF only)
    - Saves to the uploads directory
    - Splits into chunks and generates embeddings
    - Stores chunks in ChromaDB
    - Records metadata for the document list endpoint
    """
    # ── Validate content type ──────────────────────────────────────────────
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES and not (
        file.filename or ""
    ).lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are accepted. Please upload a .pdf file.",
        )

    # ── Read file content & validate size ──────────────────────────────────
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_FILE_SIZE_MB}MB size limit.",
        )
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    upload_id = str(uuid.uuid4())
    original_filename = file.filename or f"document_{upload_id}.pdf"
    safe_filename = f"{upload_id}_{original_filename}"
    file_path = os.path.join(settings.upload_dir, safe_filename)

    # ── Save file to disk ─────────────────────────────────────────────────
    os.makedirs(settings.upload_dir, exist_ok=True)
    async with aiofiles.open(file_path, "wb") as out:
        await out.write(content)
    logger.info("Saved upload: %s (%d bytes)", safe_filename, len(content))

    # ── Process PDF → chunks ──────────────────────────────────────────────
    try:
        chunks = await process_pdf(file_path, original_filename, upload_id)
    except Exception as exc:
        # Clean up saved file on processing error
        os.remove(file_path)
        logger.exception("PDF processing failed for %s", original_filename)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process PDF: {str(exc)}",
        )

    if not chunks:
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text could be extracted from the PDF. It may be a scanned image.",
        )

    # ── Store embeddings in ChromaDB ──────────────────────────────────────
    try:
        chunk_count = await add_documents(chunks)
    except Exception as exc:
        os.remove(file_path)
        logger.exception("Vector store insertion failed for %s", original_filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store embeddings: {str(exc)}",
        )

    # ── Persist document metadata ──────────────────────────────────────────
    registry = _load_registry(settings)
    registry.append(
        {
            "id": upload_id,
            "filename": original_filename,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "chunk_count": chunk_count,
            "size_bytes": len(content),
        }
    )
    _save_registry(settings, registry)

    logger.info(
        "Ingested '%s' → %d chunks (id=%s)", original_filename, chunk_count, upload_id
    )

    return UploadResponse(
        success=True,
        document_id=upload_id,
        filename=original_filename,
        chunk_count=chunk_count,
        message=f"Successfully ingested '{original_filename}' into {chunk_count} searchable chunks.",
    )
