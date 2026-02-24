"""Provider contracts for pluggable LLM integrations."""

from typing import Protocol

from backend.prompts import CategoryResponse, ScoringResponse


class LLMProvider(Protocol):
    """Minimal provider contract for scoring orchestration."""

    name: str

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
