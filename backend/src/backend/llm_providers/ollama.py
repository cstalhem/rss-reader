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
    ArticleCategoryResult,
    ArticleScoringResult,
    BatchCategoryResponse,
    BatchScoringResponse,
    CategoryResponse,
    ScoringResponse,
    build_batch_categorization_prompt,
    build_batch_scoring_prompt,
    build_categorization_prompt,
    build_scoring_prompt,
)
from backend.prompts.grouping import GroupingResponse, build_grouping_prompt

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


@retry(
    retry=retry_if_exception_type(TRANSIENT_ERRORS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def categorize_articles(
    articles: list[dict],
    existing_categories: list[str],
    host: str,
    model: str,
    thinking: bool = False,
    category_hierarchy: dict[str, list[str]] | None = None,
    hidden_categories: list[str] | None = None,
) -> list[ArticleCategoryResult]:
    """Categorize a batch of articles using Ollama LLM.

    Args:
        articles: List of dicts with keys: id, title, content_markdown
        existing_categories: List of existing categories to reuse
        host: Ollama server URL
        model: Ollama model name
        thinking: Whether to enable extended thinking mode
        category_hierarchy: Optional parent-child hierarchy
        hidden_categories: Optional list of hidden category names to avoid

    Returns:
        List of ArticleCategoryResult for each article
    """
    from backend.scoring import _scoring_activity

    system_prompt, user_message = build_batch_categorization_prompt(
        articles,
        existing_categories,
        category_hierarchy,
        hidden_categories=hidden_categories,
    )

    client = get_ollama_client(host)
    content = ""
    async for chunk in await client.chat(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        format=BatchCategoryResponse.model_json_schema(),
        options={"temperature": 0},
        stream=True,
        think=True if thinking else None,
    ):
        if chunk["message"].get("thinking"):
            _scoring_activity["phase"] = "thinking"
        if chunk["message"].get("content"):
            _scoring_activity["phase"] = "categorizing"
        content += chunk["message"].get("content") or ""

    result = BatchCategoryResponse.model_validate_json(content)
    logger.info("Categorized %d articles in batch", len(result.results))
    return result.results


@retry(
    retry=retry_if_exception_type(TRANSIENT_ERRORS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def score_articles(
    articles: list[dict],
    interests: str,
    anti_interests: str,
    host: str,
    model: str,
    thinking: bool = False,
) -> list[ArticleScoringResult]:
    """Score a batch of articles using Ollama LLM.

    Args:
        articles: List of dicts with keys: id, title, content_markdown
        interests: User's interest preferences
        anti_interests: User's anti-interest preferences
        host: Ollama server URL
        model: Ollama model name
        thinking: Whether to enable extended thinking mode

    Returns:
        List of ArticleScoringResult for each article
    """
    from backend.scoring import _scoring_activity

    system_prompt, user_message = build_batch_scoring_prompt(
        articles, interests, anti_interests
    )

    client = get_ollama_client(host)
    content = ""
    async for chunk in await client.chat(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        format=BatchScoringResponse.model_json_schema(),
        options={"temperature": 0},
        stream=True,
        think=True if thinking else None,
    ):
        if chunk["message"].get("thinking"):
            _scoring_activity["phase"] = "thinking"
        if chunk["message"].get("content"):
            _scoring_activity["phase"] = "scoring"
        content += chunk["message"].get("content") or ""

    result = BatchScoringResponse.model_validate_json(content)
    logger.info("Scored %d articles in batch", len(result.results))
    return result.results


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
    batch_size: int = Field(default=1, ge=1, le=50)

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

    async def health(self, config: ProviderTaskConfig) -> dict:
        return await ollama_service.check_health(config.endpoint)

    async def list_models(self, config: ProviderTaskConfig) -> list[dict]:
        return await ollama_service.list_models(config.endpoint)

    async def categorize(
        self,
        articles: list[dict],
        existing_categories: list[str],
        config: ProviderTaskConfig,
        category_hierarchy: dict[str, list[str]] | None,
        hidden_categories: list[str] | None,
    ) -> list[ArticleCategoryResult]:
        return await categorize_articles(
            articles,
            existing_categories,
            host=config.endpoint,
            model=config.model,
            thinking=config.thinking,
            category_hierarchy=category_hierarchy,
            hidden_categories=hidden_categories,
        )

    async def score(
        self,
        articles: list[dict],
        interests: str,
        anti_interests: str,
        config: ProviderTaskConfig,
    ) -> list[ArticleScoringResult]:
        return await score_articles(
            articles,
            interests,
            anti_interests,
            host=config.endpoint,
            model=config.model,
            thinking=config.thinking,
        )

    async def suggest_groups(
        self,
        all_categories: list[str],
        existing_groups: dict[str, list[str]],
        config: ProviderTaskConfig,
    ) -> GroupingResponse:
        prompt = build_grouping_prompt(all_categories, existing_groups)

        client = get_ollama_client(config.endpoint)
        content = ""
        async for chunk in await client.chat(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            format=GroupingResponse.model_json_schema(),
            options={"temperature": 0},
            stream=True,
        ):
            content += chunk["message"].get("content") or ""

        result = GroupingResponse.model_validate_json(content)
        logger.info("Suggested %d category groups", len(result.groups))
        return result

    async def close(self) -> None:
        await close_ollama_client()
