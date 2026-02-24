"""Ollama provider implementation and typed config."""

from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

from backend import ollama_service
from backend.prompts import CategoryResponse, ScoringResponse
from backend.scoring import categorize_article, score_article

DEFAULT_OLLAMA_BASE_URL = "http://localhost"
DEFAULT_OLLAMA_PORT = 11434


def split_ollama_host(host: str) -> tuple[str, int]:
    """Split legacy host URL into base URL + port."""
    parsed = urlparse(host)
    if parsed.scheme in {"http", "https"} and parsed.hostname:
        hostname = parsed.hostname
        if ":" in hostname and not hostname.startswith("["):
            hostname = f"[{hostname}]"
        base_url = f"{parsed.scheme}://{hostname}"
        port = parsed.port or DEFAULT_OLLAMA_PORT
        return base_url, port
    return DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_PORT


class OllamaProviderConfig(BaseModel):
    """Validated Ollama runtime configuration."""

    base_url: str = DEFAULT_OLLAMA_BASE_URL
    port: int = Field(default=DEFAULT_OLLAMA_PORT, ge=1, le=65535)
    categorization_model: str | None = None
    scoring_model: str | None = None
    use_separate_models: bool = False
    thinking: bool = False

    @field_validator("base_url")
    @classmethod
    def _validate_base_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("base_url must use http or https")
        if not parsed.hostname:
            raise ValueError("base_url must include a valid host")
        if parsed.path not in {"", "/"}:
            raise ValueError("base_url must not include a path")
        if parsed.query or parsed.fragment:
            raise ValueError("base_url must not include query or fragment")
        if parsed.port is not None:
            raise ValueError("base_url must not include a port")
        if parsed.username or parsed.password:
            raise ValueError("base_url must not include credentials")

        hostname = parsed.hostname
        if hostname is None:
            raise ValueError("base_url must include a valid host")
        if ":" in hostname and not hostname.startswith("["):
            hostname = f"[{hostname}]"
        return f"{parsed.scheme}://{hostname}"

    @property
    def endpoint(self) -> str:
        return f"{self.base_url}:{self.port}"

    def default_model_for_task(self, task: str) -> str | None:
        if task == "categorization":
            return self.categorization_model
        if self.use_separate_models:
            return self.scoring_model or self.categorization_model
        return self.categorization_model


class OllamaProvider:
    """Provider adapter that delegates to existing Ollama services."""

    name = "ollama"

    async def health(self, endpoint: str) -> dict:
        return await ollama_service.check_health(endpoint)

    async def list_models(self, endpoint: str) -> list[dict]:
        return await ollama_service.list_models(endpoint)

    async def categorize(
        self,
        article_title: str,
        article_text: str,
        existing_categories: list[str],
        endpoint: str,
        model: str,
        thinking: bool,
        category_hierarchy: dict[str, list[str]] | None,
        hidden_categories: list[str] | None,
    ) -> CategoryResponse:
        return await categorize_article(
            article_title,
            article_text,
            existing_categories,
            host=endpoint,
            model=model,
            thinking=thinking,
            category_hierarchy=category_hierarchy,
            hidden_categories=hidden_categories,
        )

    async def score(
        self,
        article_title: str,
        article_text: str,
        interests: str,
        anti_interests: str,
        endpoint: str,
        model: str,
        thinking: bool,
    ) -> ScoringResponse:
        return await score_article(
            article_title,
            article_text,
            interests,
            anti_interests,
            host=endpoint,
            model=model,
            thinking=thinking,
        )
