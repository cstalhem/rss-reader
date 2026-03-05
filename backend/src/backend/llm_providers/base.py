"""Provider contracts for pluggable LLM integrations."""

from dataclasses import dataclass
from typing import Protocol

from backend.prompts import CategoryResponse, ScoringResponse


@dataclass
class ProviderTaskConfig:
    endpoint: str | None
    model: str | None
    thinking: bool


class LLMProvider(Protocol):
    """Minimal provider contract for scoring orchestration."""

    name: str

    def parse_config(self, config_json: str, task: str) -> ProviderTaskConfig: ...

    async def health(self, endpoint: str) -> dict: ...

    async def list_models(self, endpoint: str) -> list[dict]: ...

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
    ) -> CategoryResponse: ...

    async def score(
        self,
        article_title: str,
        article_text: str,
        interests: str,
        anti_interests: str,
        endpoint: str,
        model: str,
        thinking: bool,
    ) -> ScoringResponse: ...

    async def close(self) -> None: ...
