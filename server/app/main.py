"""
FastAPI application entry point.

Sets up:
  - CORS middleware (allows the React dev client at localhost:5173)
  - API routes under /api prefix
  - Lifespan event for startup initialisation (embedding model pre-warm, dirs)
  - Health check endpoint
"""
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models import HealthResponse
from app.routes import chat, documents, upload
from app.services.embeddings import get_embeddings
from app.services.llm_provider import get_provider_info
from app.services.vector_store import get_vector_store

# ── Logging configuration ─────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan — startup & shutdown ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.

    On startup:
      - Ensures storage directories exist
      - Pre-warms the embedding model (downloads on first run)
      - Initialises the ChromaDB vector store
    """
    settings = get_settings()

    # Create storage directories
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.chroma_persist_dir, exist_ok=True)
    os.makedirs(settings.sessions_dir, exist_ok=True)
    logger.info("Storage directories ready.")

    # Pre-warm embedding model (loads ~80MB ONNX model on first run)
    logger.info("Pre-warming embedding model...")
    get_embeddings()

    # Initialise ChromaDB connection
    logger.info("Connecting to ChromaDB...")
    get_vector_store()

    provider = get_provider_info()
    logger.info(
        "AgenticRag server ready | LLM: %s (%s) | Listening on :%s",
        provider["provider"],
        provider["model"],
        settings.port,
    )

    yield  # Application is running

    logger.info("AgenticRag server shutting down.")


# ── App instance ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="AgenticRag API",
    description="Personal AI document assistant — chat with your PDFs using RAG.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins since it's proxied
    allow_credentials=False, # Must be false when using wildcard origins
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(upload.router, prefix="/api", tags=["documents"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(documents.router, prefix="/api", tags=["documents"])


# ── Health check ──────────────────────────────────────────────────────────────

@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["system"],
    summary="Health check",
)
async def health_check() -> HealthResponse:
    """Returns server status and active LLM provider info."""
    provider = get_provider_info()
    return HealthResponse(
        status="ok",
        provider=provider["provider"],
        model=provider["model"],
    )
