"""Provider contracts for pluggable LLM integrations."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from pydantic import BaseModel

from backend.prompts import ArticleCategoryResult, ArticleScoringResult
from backend.prompts.grouping import GroupingResponse

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_RAW_PREVIEW_CHARS = 500


class LLMValidationError(Exception):
    """LLM returned output that failed schema validation.

    Attributes:
        raw_response: The full raw text the LLM returned (or None if empty).
        original_exc: The underlying parse/validation exception.
        is_retryable: True for empty/truncated/malformed JSON (transient);
                      False for valid JSON that violates schema constraints (deterministic).
    """

    def __init__(
        self,
        raw_response: str | None,
        original_exc: Exception | None,
        *,
        is_retryable: bool,
    ) -> None:
        self.raw_response = raw_response
        self.original_exc = original_exc
        self.is_retryable = is_retryable
        preview = (raw_response or "<empty>")[:_RAW_PREVIEW_CHARS]
        retryable_tag = "retryable" if is_retryable else "deterministic"
        super().__init__(
            f"LLM output failed validation ({retryable_tag}): {original_exc}\n"
            f"Raw response (truncated): {preview}"
        )


def validate_llm_response[T: BaseModel](raw: str | None, schema: type[T]) -> T:
    """Validate raw LLM JSON against a Pydantic schema.

    Uses a two-step parse: json.loads to classify failure type, then
    model_validate_json for authoritative validation.

    Raises:
        LLMValidationError: Always. is_retryable=True for empty/malformed JSON,
                            is_retryable=False for valid JSON that fails schema.
    """
    stripped = (raw or "").strip()
    if not stripped:
        raise LLMValidationError(
            raw, ValueError("LLM returned empty response"), is_retryable=True
        )

    # Step 1: Can we parse it as JSON at all?
    try:
        json.loads(stripped)
    except json.JSONDecodeError as e:
        raise LLMValidationError(raw, e, is_retryable=True) from e

    # Step 2: Does it match the Pydantic schema?
    try:
        return schema.model_validate_json(stripped)
    except Exception as e:
        raise LLMValidationError(raw, e, is_retryable=False) from e


@dataclass
class ProviderTaskConfig:
    endpoint: str | None
    model: str | None
    thinking: bool
    api_key: str | None = None
    selected_models: list[str] | None = None


class LLMProvider(Protocol):
    """Minimal provider contract for scoring orchestration."""

    name: str

    def parse_config(self, config_json: str, task: str) -> ProviderTaskConfig: ...

    async def health(self, config: ProviderTaskConfig) -> dict: ...

    async def list_models(self, config: ProviderTaskConfig) -> list[dict]: ...

    async def categorize(
        self,
        articles: list[dict],
        existing_categories: list[str],
        config: ProviderTaskConfig,
        category_hierarchy: dict[str, list[str]] | None,
        hidden_categories: list[str] | None,
    ) -> list[ArticleCategoryResult]: ...

    async def score(
        self,
        articles: list[dict],
        interests: str,
        anti_interests: str,
        config: ProviderTaskConfig,
    ) -> list[ArticleScoringResult]: ...

    async def suggest_groups(
        self,
        all_categories: list[str],
        existing_groups: dict[str, list[str]],
        config: ProviderTaskConfig,
    ) -> GroupingResponse: ...

    async def close(self) -> None: ...
