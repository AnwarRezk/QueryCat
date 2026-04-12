"""
LLM provider factory — returns the correct chat model based on USE_OPENAI.

USE_OPENAI=True  → ChatOpenAI (GPT-4o, cloud)
USE_OPENAI=False → ChatOllama (local Ollama server)

Both models support streaming via .astream().
"""
import logging
from functools import lru_cache

from langchain_core.language_models.chat_models import BaseChatModel

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_llm() -> BaseChatModel:
    """
    Return a cached singleton chat model.

    The model is selected based on the USE_OPENAI environment variable.
    Both ChatOpenAI and ChatOllama implement the same BaseChatModel interface,
    so the rest of the application is provider-agnostic.
    """
    settings = get_settings()

    if settings.use_openai:
        from langchain_openai import ChatOpenAI

        logger.info("LLM provider: OpenAI (model=gpt-4o)")
        return ChatOpenAI(
            model="gpt-4o",
            api_key=settings.openai_api_key,
            temperature=0.2,
            streaming=True,
        )
    else:
        from langchain_ollama import ChatOllama

        logger.info(
            "LLM provider: Ollama (model=%s, base_url=%s)",
            settings.ollama_model,
            settings.ollama_base_url,
        )
        return ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=0.2,
        )


def get_provider_info() -> dict[str, str]:
    """Return human-readable provider metadata for health checks."""
    settings = get_settings()
    if settings.use_openai:
        return {"provider": "openai", "model": "gpt-4o"}
    return {"provider": "ollama", "model": settings.ollama_model}
