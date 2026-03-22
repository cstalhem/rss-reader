"""LLM prompt templates and response schemas for content curation.

Re-exports all public names for backward compatibility.
"""

from backend.prompts.categorization import (
    DEFAULT_CATEGORY_HIERARCHY,
    ArticleCategoryResult,
    BatchCategoryResponse,
    CategoryResponse,
    build_batch_categorization_prompt,
    build_categorization_prompt,
)
from backend.prompts.grouping import (
    GroupingResponse,
    GroupSuggestion,
    build_grouping_prompt,
)
from backend.prompts.scoring import (
    ArticleScoringResult,
    BatchScoringResponse,
    ScoringResponse,
    build_batch_scoring_prompt,
    build_scoring_prompt,
)

__all__ = [
    "ArticleCategoryResult",
    "ArticleScoringResult",
    "BatchCategoryResponse",
    "BatchScoringResponse",
    "CategoryResponse",
    "DEFAULT_CATEGORY_HIERARCHY",
    "GroupSuggestion",
    "GroupingResponse",
    "ScoringResponse",
    "build_batch_categorization_prompt",
    "build_batch_scoring_prompt",
    "build_categorization_prompt",
    "build_grouping_prompt",
    "build_scoring_prompt",
]
