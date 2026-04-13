"""
Pydantic v2 request/response models for the AgenticRag API.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Request Models ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Payload for the POST /api/chat endpoint."""

    message: str = Field(..., min_length=1, description="The user's question or message.")
    session_id: str = Field(..., min_length=1, description="Unique session identifier for conversation memory.")


# ── Response Models ───────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    """Response from POST /api/upload (kept for backwards compat)."""

    success: bool
    document_id: str
    filename: str
    chunk_count: int
    message: str


class FileUploadResult(BaseModel):
    """Result for a single file within a multi-file upload."""

    success: bool
    filename: str
    document_id: Optional[str] = None
    chunk_count: int = 0
    file_type: Optional[str] = None
    error: Optional[str] = None


class MultiUploadResponse(BaseModel):
    """Response from POST /api/upload (multi-file, Phase 2)."""

    results: list[FileUploadResult]
    total_files: int
    successful: int
    total_chunks: int
    message: str


class DocumentInfo(BaseModel):
    """Metadata for a single ingested document."""

    id: str
    filename: str
    uploaded_at: str
    chunk_count: int
    size_bytes: int
    file_type: Optional[str] = None
    session_id: Optional[str] = None


class DocumentListResponse(BaseModel):
    """Response from GET /api/documents."""

    documents: list[DocumentInfo]
    total: int


class HealthResponse(BaseModel):
    """Response from GET /api/health."""

    status: str
    provider: str
    model: str
    version: str = "2.0.0"


class ErrorResponse(BaseModel):
    """Standard error response body."""

    detail: str
    error_code: str = "INTERNAL_ERROR"
