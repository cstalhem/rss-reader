"""LLM prompt templates and response schemas for content curation."""

from backend.prompts.categorization import (
    ArticleCategoryResult,
    BatchCategoryResponse,
    build_batch_categorization_prompt,
    build_categorization_schema,
)
from backend.prompts.grouping import (
    GroupingResponse,
    GroupSuggestion,
    build_grouping_prompt,
)
from backend.prompts.scoring import (
    ArticleScoringResult,
    BatchScoringResponse,
    build_batch_scoring_prompt,
)

__all__ = [
    "ArticleCategoryResult",
    "ArticleScoringResult",
    "BatchCategoryResponse",
    "BatchScoringResponse",
    "GroupSuggestion",
    "GroupingResponse",
    "build_batch_categorization_prompt",
    "build_batch_scoring_prompt",
    "build_categorization_schema",
    "build_grouping_prompt",
]
