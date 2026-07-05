"""LLM prompt templates and response schemas for article categorization.

Response models are used as Azure structured-output schemas: keep them free
of JSON-schema constraint keywords (maxItems, minimum, ...) that strict mode
may reject — limits are enforced by the prompt and clamped in the worker.
"""

from typing import Literal

from pydantic import BaseModel, create_model


class ArticleCategoryResult(BaseModel):
    """Single article result within a batch categorization response.

    Static empty-vocabulary base (ADR-0006): `categories` degrades to
    list[str] when there are no display names to enumerate.
    """

    article_id: int
    categories: list[str]
    proposed_category: str | None


class BatchCategoryResponse(BaseModel):
    """Batch response containing categorization results for multiple articles."""

    results: list[ArticleCategoryResult]


def build_categorization_schema(
    display_names: list[str],
) -> type[BatchCategoryResponse]:
    """Build the per-batch categorization response schema (ADR-0006).

    With a non-empty vocabulary, `categories` is list[Literal[*display_names]]
    so out-of-vocabulary assignment is unrepresentable at generation time.
    An empty vocabulary falls back to the static list[str] base so the batch
    degrades instead of deadlocking; proposals rebuild the vocabulary.
    """
    if not display_names:
        return BatchCategoryResponse

    category_enum = Literal[tuple(display_names)]  # pyright: ignore[reportInvalidTypeArguments]
    result_model = create_model(
        "ArticleCategoryResult",
        __base__=ArticleCategoryResult,
        categories=(list[category_enum], ...),  # pyright: ignore[reportInvalidTypeForm]
    )
    return create_model(
        "BatchCategoryResponse",
        __base__=BatchCategoryResponse,
        results=(list[result_model], ...),
    )


def build_batch_categorization_prompt(
    articles: list[dict],
    existing_categories: list[str],
) -> tuple[str, str]:
    """Build system prompt and user message for batch categorization.

    Args:
        articles: List of dicts with keys: id, title, content_markdown
        existing_categories: The category vocabulary (display names)

    Returns:
        Tuple of (system_prompt, user_message)
    """
    from backend.prompts.content import CATEGORIZATION_MAX_CHARS, format_articles_block

    categories_list = ", ".join(sorted(existing_categories))

    system_prompt = f"""Categorize articles into 1-4 topic categories each.

**Rules (follow strictly):**
1. ONLY categorize each article's PRIMARY topics — what the article is fundamentally about.
2. IGNORE incidental mentions, anecdotes, metaphors, and examples used to illustrate a point.
3. Assign ONLY categories from the vocabulary below. Maximum 4 per article; fewer is better.
4. Prefer the most specific fitting category in the vocabulary. Use `proposed_category` when the article's primary topic is meaningfully more specific than the best-fitting existing category AND that topic is likely to recur across many articles (e.g., if articles about cooking are only covered by "Culture", propose "Food"). Set it to null when an existing category already captures the topic well.
5. Propose at most ONE new category per article. Proposed names must be human-readable English. Do NOT use kebab-case, underscores, or slashes. Even if the article is in another language, always use English names.
6. Keep proposals at recurring-topic breadth, not niche specificity. Use "Food" not "Sourdough Baking". Use "Programming" not "Python Development".

**Category vocabulary:** {categories_list}

You will receive multiple articles wrapped in `<article>` tags. Return a JSON object with a `results` array. Each entry must include the `article_id` from the input."""

    user_message = format_articles_block(articles, max_chars=CATEGORIZATION_MAX_CHARS)

    return system_prompt, user_message
