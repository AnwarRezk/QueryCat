"""
Centralised configuration using Pydantic Settings v2.
Reads from .env file in the server/ directory.
"""
from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings — all values sourced from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM Provider ──────────────────────────────────────────────────────
    # True  → OpenAI GPT-4o (cloud, requires OPENAI_API_KEY)
    # False → Ollama (local, free)
    use_openai: bool = True

    # ── OpenAI ────────────────────────────────────────────────────────────
    openai_api_key: str = ""

    # ── Ollama ────────────────────────────────────────────────────────────
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # ── Server ────────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 3001

    # ── Storage ───────────────────────────────────────────────────────────
    chroma_persist_dir: str = "./chroma_data"
    upload_dir: str = "./uploads"
    sessions_dir: str = "./sessions"

    # ── Retrieval ─────────────────────────────────────────────────────────
    retrieval_k: int = 8           # Number of chunks to retrieve per query (higher for multi-doc comparison)
    chunk_size: int = 1000         # Characters per chunk
    chunk_overlap: int = 200       # Overlap between chunks
    max_history_messages: int = 20  # Messages to keep in session memory

    @model_validator(mode="after")
    def validate_openai_key(self) -> "Settings":
        if self.use_openai and not self.openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY must be set when USE_OPENAI=True. "
                "Either set the key or switch to USE_OPENAI=False to use Ollama."
            )
        return self

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def strip_key(cls, v: str) -> str:
        return v.strip() if v else v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
