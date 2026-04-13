"""
POST /api/upload — Multi-file document ingestion endpoint (Phase 2).

Accepts multiple files in a single multipart/form-data request along with
a session_id to scope the documents to the current conversation.

Supported formats: .pdf, .docx, .md
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Annotated, List

import aiofiles
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status

from app.config import Settings, get_settings
from app.models import FileUploadResult, MultiUploadResponse
from app.services.document_processor import ALLOWED_EXTENSIONS, process_document
from app.services.vector_store import add_documents

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_FILES_PER_REQUEST = 10

CONTENT_TYPE_MAP = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/markdown": ".md",
    "text/plain": ".md",  # Allow .md sent as plain text
}


def _get_documents_registry_path(settings: Settings) -> str:
    return os.path.join(settings.upload_dir, "documents.json")


def _load_registry(settings: Settings) -> list[dict]:
    registry_path = _get_documents_registry_path(settings)
    if not os.path.exists(registry_path):
        return []
    with open(registry_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_registry(settings: Settings, registry: list[dict]) -> None:
    registry_path = _get_documents_registry_path(settings)
    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)


def _validate_extension(filename: str) -> str:
    """Return lower-case extension or raise HTTPException."""
    from pathlib import Path
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File '{filename}' has unsupported type '{ext}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )
    return ext


async def _process_single_file(
    file: UploadFile,
    session_id: str,
    settings: Settings,
) -> FileUploadResult:
    """Process one file and return its result. Never raises — errors are captured."""
    filename = file.filename or f"upload_{uuid.uuid4()}"

    try:
        # Validate extension
        _validate_extension(filename)

        # Read content
        content = await file.read()

        if len(content) == 0:
            return FileUploadResult(success=False, filename=filename, error="File is empty.")

        if len(content) > MAX_FILE_SIZE_BYTES:
            return FileUploadResult(
                success=False,
                filename=filename,
                error=f"File exceeds {MAX_FILE_SIZE_MB} MB size limit.",
            )

        # Save to disk
        upload_id = str(uuid.uuid4())
        from pathlib import Path
        ext = Path(filename).suffix.lower()
        safe_filename = f"{upload_id}_{filename}"
        file_path = os.path.join(settings.upload_dir, safe_filename)

        os.makedirs(settings.upload_dir, exist_ok=True)
        async with aiofiles.open(file_path, "wb") as out:
            await out.write(content)

        logger.info("Saved upload: %s (%d bytes, session=%s)", safe_filename, len(content), session_id)

        # Process into chunks (session-scoped)
        try:
            chunks = await process_document(file_path, filename, upload_id, session_id)
        except Exception as exc:
            os.remove(file_path)
            logger.exception("Document processing failed for %s", filename)
            return FileUploadResult(success=False, filename=filename, error=f"Processing failed: {str(exc)}")

        if not chunks:
            os.remove(file_path)
            return FileUploadResult(
                success=False,
                filename=filename,
                error="No text could be extracted from the file.",
            )

        # Store in vector DB
        try:
            chunk_count = await add_documents(chunks)
        except Exception as exc:
            os.remove(file_path)
            logger.exception("Vector store insertion failed for %s", filename)
            return FileUploadResult(success=False, filename=filename, error=f"Storage failed: {str(exc)}")

        # Record metadata in registry
        from pathlib import Path as P
        file_type = P(filename).suffix.lower().lstrip(".")
        registry = _load_registry(settings)
        registry.append(
            {
                "id": upload_id,
                "filename": filename,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "chunk_count": chunk_count,
                "size_bytes": len(content),
                "file_type": file_type,
                "session_id": session_id,
            }
        )
        _save_registry(settings, registry)

        logger.info(
            "Ingested '%s' → %d chunks (type=%s, session=%s)",
            filename, chunk_count, file_type, session_id,
        )

        return FileUploadResult(
            success=True,
            filename=filename,
            document_id=upload_id,
            chunk_count=chunk_count,
            file_type=file_type,
        )

    except HTTPException as http_exc:
        return FileUploadResult(success=False, filename=filename, error=http_exc.detail)
    except Exception as exc:
        logger.exception("Unexpected error processing %s", filename)
        return FileUploadResult(success=False, filename=filename, error=str(exc))


@router.post(
    "/upload",
    response_model=MultiUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest one or more documents (PDF, DOCX, MD)",
)
async def upload_documents(
    files: List[UploadFile],
    session_id: Annotated[str, Form()],
    settings: Annotated[Settings, Depends(get_settings)],
) -> MultiUploadResponse:
    """
    Upload one or more documents for ingestion into the vector database,
    scoped to the provided session_id.

    - Supports .pdf, .docx, and .md files
    - All files are linked to the given session_id for scoped retrieval
    - Each file result is returned individually, failures don't abort others
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files were provided.",
        )

    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_FILES_PER_REQUEST} files per upload. Got {len(files)}.",
        )

    if not session_id or not session_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required.",
        )

    # Process each file, collecting results
    results: list[FileUploadResult] = []
    for file in files:
        result = await _process_single_file(file, session_id.strip(), settings)
        results.append(result)

    successful = sum(1 for r in results if r.success)
    total_chunks = sum(r.chunk_count for r in results)

    if successful == 0:
        message = "All uploads failed. Check individual results for details."
    elif successful < len(results):
        message = f"{successful}/{len(results)} files ingested successfully ({total_chunks} chunks total)."
    else:
        message = f"All {successful} file(s) ingested successfully ({total_chunks} chunks total)."

    return MultiUploadResponse(
        results=results,
        total_files=len(results),
        successful=successful,
        total_chunks=total_chunks,
        message=message,
    )
