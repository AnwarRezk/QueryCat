"""
PDF processing service — parses PDFs and splits them into chunks.

Uses LangChain's PyPDFLoader + RecursiveCharacterTextSplitter to produce
Document chunks ready for embedding and storage.
"""
import logging
import os
import uuid

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings

logger = logging.getLogger(__name__)


async def process_pdf(file_path: str, filename: str, upload_id: str) -> list[Document]:
    """
    Load a PDF file, split it into chunks, and return enriched Documents.

    Args:
        file_path: Absolute path to the saved PDF file.
        filename:  Original filename (used as source metadata).
        upload_id: Unique ID for this upload batch.

    Returns:
        List of Document objects ready for embedding.
    """
    settings = get_settings()

    logger.info("Loading PDF: %s", filename)
    loader = PyPDFLoader(file_path)
    pages = loader.load()
    logger.info("Loaded %d pages from %s", len(pages), filename)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = splitter.split_documents(pages)

    # Enrich metadata on each chunk
    for idx, chunk in enumerate(chunks):
        chunk.metadata.update(
            {
                "source": filename,
                "upload_id": upload_id,
                "chunk_index": idx,
                "total_chunks": len(chunks),
            }
        )

    logger.info(
        "Split %s into %d chunks (size=%d, overlap=%d)",
        filename,
        len(chunks),
        settings.chunk_size,
        settings.chunk_overlap,
    )
    return chunks
