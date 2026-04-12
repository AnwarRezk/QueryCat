"""
Embedding service using HuggingFace all-MiniLM-L6-v2.

This service provides a singleton LangChain-compatible Embeddings object
that runs locally via sentence-transformers (no API key required).
The model produces 384-dimensional normalized vectors.
"""
import logging
from functools import lru_cache

from langchain_huggingface import HuggingFaceEmbeddings

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Return a cached singleton HuggingFaceEmbeddings instance.

    The first call downloads the model (~80MB) to the local HuggingFace cache.
    Subsequent calls return the cached object immediately.
    """
    logger.info("Loading embedding model: %s", EMBEDDING_MODEL_NAME)
    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL_NAME,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )
    logger.info("Embedding model loaded successfully.")
    return embeddings
