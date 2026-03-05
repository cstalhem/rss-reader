"""Ollama provider implementation, typed config, and client management."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from urllib.parse import urlparse

import httpx
from ollama import AsyncClient
from pydantic import BaseModel, Field, field_validator
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from backend import ollama_service

if TYPE_CHECKING:
    from sqlmodel import Session

    from backend.llm_providers.base import ProviderTaskConfig

from backend.prompts import (
    CategoryResponse,
    ScoringResponse,
    build_categorization_prompt,
    build_scoring_prompt,
)

logger = logging.getLogger(__name__)

OLLAMA_PROVIDER = "ollama"

DEFAULT_OLLAMA_BASE_URL = "http://localhost"
DEFAULT_OLLAMA_PORT = 11434

# --- Shared Ollama AsyncClient singleton ---

OLLAMA_CONNECT_TIMEOUT = 10.0
OLLAMA_READ_TIMEOUT = 300.0  # Time-to-first-chunk can be long (model loading, thinking)

_client: AsyncClient | None = None
_client_host: str | None = None


def get_ollama_client(host: str) -> AsyncClient:
    """Return a shared AsyncClient, creating one lazily on first call."""
    global _client, _client_host
    if _client is None or _client_host != host:
        timeout = httpx.Timeout(
            connect=OLLAMA_CONNECT_TIMEOUT,
            read=OLLAMA_READ_TIMEOUT,
            write=30.0,
            pool=10.0,
        )
        _client = AsyncClient(host=host, timeout=timeout)
        _client_host = host
    return _client


async def close_ollama_client() -> None:
    """Close the shared client's underlying httpx connection pool."""
    global _client, _client_host
    if _client is not None:
        try:
            await _client._client.aclose()  # noqa: SLF001
        except Exception:
            logger.debug("Error closing Ollama client", exc_info=True)
        _client = None
        _client_host = None


# --- Transient errors for retry logic ---

TRANSIENT_ERRORS = (
    ConnectionError,
    TimeoutError,
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.ConnectTimeout,
)


# --- Scoring / categorization functions ---


@retry(
    retry=retry_if_exception_type(TRANSIENT_ERRORS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def categorize_article(
    article_title: str,
    article_text: str,
    existing_categories: list[str],
    host: str,
    model: str,
    thinking: bool = False,
    category_hierarchy: dict[str, list[str]] | None = None,
    hidden_categories: list[str] | None = None,
) -> CategoryResponse:
    """Categorize an article using Ollama LLM.

    Args:
        article_title: Article title
        article_text: Article content
        existing_categories: List of existing categories to reuse
        host: Ollama server URL
        model: Ollama model name to use for categorization
        thinking: Whether to enable extended thinking mode
        category_hierarchy: Optional parent-child hierarchy to guide categorization
        hidden_categories: Optional list of hidden category names to avoid

    Returns:
        CategoryResponse with assigned categories and suggestions

    Raises:
        Exception: On LLM call failure after retries
    """
    from backend.scoring import _scoring_activity

    prompt = build_categorization_prompt(
        article_title,
        article_text,
        existing_categories,
        category_hierarchy,
        hidden_categories=hidden_categories,
    )

    client = get_ollama_client(host)
    # Use streaming to prevent httpx.ReadTimeout on slower models
    content = ""
    async for chunk in await client.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        format=CategoryResponse.model_json_schema(),
        options={"temperature": 0},
        stream=True,
        think=True if thinking else None,
    ):
        if chunk["message"].get("thinking"):
            _scoring_activity["phase"] = "thinking"
        if chunk["message"].get("content"):
            _scoring_activity["phase"] = "categorizing"
        content += chunk["message"].get("content") or ""

    # Parse accumulated structured response
    result = CategoryResponse.model_validate_json(content)

    logger.info(
        f"Categorized article: {len(result.categories)} categories, "
        f"{len(result.suggested_new)} suggestions"
    )

    return result


@retry(
    retry=retry_if_exception_type(TRANSIENT_ERRORS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def score_article(
    article_title: str,
    article_text: str,
    interests: str,
    anti_interests: str,
    host: str,
    model: str,
    thinking: bool = False,
) -> ScoringResponse:
    """Score an article's interest and quality using Ollama LLM.

    Args:
        article_title: Article title
        article_text: Article content
        interests: User's interest preferences
        anti_interests: User's anti-interest preferences
        host: Ollama server URL
        model: Ollama model name to use for scoring
        thinking: Whether to enable extended thinking mode

    Returns:
        ScoringResponse with interest/quality scores and reasoning

    Raises:
        Exception: On LLM call failure after retries
    """
    from backend.scoring import _scoring_activity

    prompt = build_scoring_prompt(
        article_title, article_text, interests, anti_interests
    )

    client = get_ollama_client(host)
    # Use streaming to prevent httpx.ReadTimeout on slower models
    content = ""
    async for chunk in await client.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        format=ScoringResponse.model_json_schema(),
        options={"temperature": 0},
        stream=True,
        think=True if thinking else None,
    ):
        if chunk["message"].get("thinking"):
            _scoring_activity["phase"] = "thinking"
        if chunk["message"].get("content"):
            _scoring_activity["phase"] = "scoring"
        content += chunk["message"].get("content") or ""

    # Parse accumulated structured response
    result = ScoringResponse.model_validate_json(content)

    logger.info(
        f"Scored article: interest={result.interest_score}, "
        f"quality={result.quality_score}"
    )

    return result


# --- Config models ---


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


# --- Provider helper ---


def get_ollama_provider_config(session: Session) -> OllamaProviderConfig:
    """Get validated Ollama config from LLMProviderConfig table."""
    from backend.deps import get_provider_config_row

    row = get_provider_config_row(session, OLLAMA_PROVIDER)
    if row:
        try:
            config = OllamaProviderConfig.model_validate_json(row.config_json)
            return config.model_copy(update={"thinking": False})
        except Exception:
            logger.exception("Invalid Ollama provider config JSON")

    # No row means provider not configured -- return defaults
    return OllamaProviderConfig()


# --- Provider class ---


class OllamaProvider:
    """Provider adapter that delegates to existing Ollama services."""

    name = "ollama"

    def parse_config(self, config_json: str, task: str) -> ProviderTaskConfig:
        from backend.llm_providers.base import ProviderTaskConfig

        config = OllamaProviderConfig.model_validate_json(config_json)
        return ProviderTaskConfig(
            endpoint=config.endpoint,
            model=config.default_model_for_task(task),
            thinking=config.thinking,
        )

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

    async def close(self) -> None:
        await close_ollama_client()
