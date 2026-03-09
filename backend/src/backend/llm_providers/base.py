"""Provider contracts for pluggable LLM integrations."""

from dataclasses import dataclass
from typing import Protocol

from backend.prompts import CategoryResponse, ScoringResponse
from backend.prompts.grouping import GroupingResponse


@dataclass
class ProviderTaskConfig:
    endpoint: str | None
    model: str | None
    thinking: bool
    api_key: str | None = None


class LLMProvider(Protocol):
    """Minimal provider contract for scoring orchestration."""

    name: str

    def parse_config(self, config_json: str, task: str) -> ProviderTaskConfig: ...

    async def health(self, config: ProviderTaskConfig) -> dict: ...

    async def list_models(self, config: ProviderTaskConfig) -> list[dict]: ...

    async def categorize(
        self,
        article_title: str,
        article_text: str,
        existing_categories: list[str],
        config: ProviderTaskConfig,
        category_hierarchy: dict[str, list[str]] | None,
        hidden_categories: list[str] | None,
    ) -> CategoryResponse: ...

    async def score(
        self,
        article_title: str,
        article_text: str,
        interests: str,
        anti_interests: str,
        config: ProviderTaskConfig,
    ) -> ScoringResponse: ...

    async def suggest_groups(
        self,
        all_categories: list[str],
        existing_groups: dict[str, list[str]],
        config: ProviderTaskConfig,
    ) -> GroupingResponse: ...

    async def close(self) -> None: ...
