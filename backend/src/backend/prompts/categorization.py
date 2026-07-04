"""LLM prompt templates and response schemas for article categorization.

Response models are used as Azure structured-output schemas: keep them free
of JSON-schema constraint keywords (maxItems, minimum, ...) that strict mode
may reject — limits are enforced by the prompt and clamped in the worker.
"""

from pydantic import BaseModel

# Default category hierarchy for new installs (parent -> children)
DEFAULT_CATEGORY_HIERARCHY: dict[str, list[str]] = {
    "Technology": ["Cybersecurity", "AI", "Programming"],
    "Science": ["Climate", "Space"],
    "Business": ["Finance", "Startups"],
    "Entertainment": ["Gaming", "Film", "Music"],
    "Culture": ["Philosophy", "History", "Design"],
    "Health": [],
    "Politics": ["Law"],
    "Education": [],
}


class ArticleCategoryResult(BaseModel):
    """Single article result within a batch categorization response."""

    article_id: int
    categories: list[str]
    suggested_new: list[str]
    suggested_parent: str | None


class BatchCategoryResponse(BaseModel):
    """Batch response containing categorization results for multiple articles."""

    results: list[ArticleCategoryResult]


def build_batch_categorization_prompt(
    articles: list[dict],
    existing_categories: list[str],
    category_hierarchy: dict[str, list[str]] | None = None,
) -> tuple[str, str]:
    """Build system prompt and user message for batch categorization.

    Args:
        articles: List of dicts with keys: id, title, content_markdown
        existing_categories: List of known categories to reuse
        category_hierarchy: Optional parent->children hierarchy

    Returns:
        Tuple of (system_prompt, user_message)
    """
    from backend.prompts.content import CATEGORIZATION_MAX_CHARS, format_articles_block

    # Format existing categories
    categories_list = ", ".join(sorted(existing_categories))

    # Format hierarchy if provided
    hierarchy_section = ""
    if category_hierarchy:
        hierarchy_lines = []
        for parent, children in sorted(category_hierarchy.items()):
            if children:
                children_str = ", ".join(children)
                hierarchy_lines.append(f"{parent} > {children_str}")
        if hierarchy_lines:
            hierarchy_section = (
                "\n\n**Category hierarchy "
                "(assign new categories as children of these parents when appropriate):**\n"
                + "\n".join(hierarchy_lines)
            )

    system_prompt = f"""Categorize articles into 1-4 topic categories each.

**Rules (follow strictly):**
1. ONLY categorize each article's PRIMARY topics — what the article is fundamentally about.
2. IGNORE incidental mentions, anecdotes, metaphors, and examples used to illustrate a point.
3. REUSE existing categories from the list below. Strongly prefer existing categories.
4. Category names should be human-readable English (e.g., "Artificial Intelligence", "Web Development", "Open Source"). Do NOT use kebab-case, underscores, or slashes. Even if the article is in another language, always use English category names.
5. Keep categories BROAD. Use "AI" not "AI-Assisted Programming" or "Generative AI". Use "Programming" not "Python Development".
6. Only suggest a new category (max 2, in suggested_new) if NO existing category covers the article's primary topic AND the topic is likely to recur across many articles. Otherwise leave suggested_new empty.
7. Maximum 4 categories per article. Fewer is better.
8. When suggesting a new category, suggest which existing parent it should belong under in the suggested_parent field (or null).

**Existing categories:** {categories_list}{hierarchy_section}

You will receive multiple articles wrapped in `<article>` tags. Return a JSON object with a `results` array. Each entry must include the `article_id` from the input."""

    user_message = format_articles_block(articles, max_chars=CATEGORIZATION_MAX_CHARS)

    return system_prompt, user_message
