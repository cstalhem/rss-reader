"""Provider contracts for pluggable LLM integrations."""

from dataclasses import dataclass
from typing import Protocol

from backend.prompts import ArticleCategoryResult, ArticleScoringResult
from backend.prompts.grouping import GroupingResponse


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
