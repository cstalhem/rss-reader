"""LLM prompt templates and response schemas for content curation."""

from pydantic import BaseModel, Field

# Default seed categories to bootstrap the system (display names)
DEFAULT_CATEGORIES = [
    "Technology",
    "Science",
    "Politics",
    "Business",
    "Finance",
    "Health",
    "Sports",
    "Entertainment",
    "Culture",
    "Gaming",
    "Programming",
    "AI",
    "Cybersecurity",
    "Climate",
    "Space",
    "Education",
    "Food",
    "Travel",
    "Design",
    "Music",
    "Film",
    "Philosophy",
    "History",
    "Law",
    "Startups",
]

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


class CategoryResponse(BaseModel):
    """Response schema for article categorization."""

    categories: list[str] = Field(
        description="1-4 broad topic categories as human-readable display names from existing list",
        max_length=4,
    )
    suggested_new: list[str] = Field(
        default=[],
        description="New human-readable display name categories only if nothing existing fits a primary topic",
        max_length=2,
    )
    suggested_parent: str | None = Field(
        default=None,
        description="Suggested parent category for any new category",
    )


class ScoringResponse(BaseModel):
    """Response schema for article interest scoring."""

    interest_score: int = Field(
        ge=0, le=10, description="Interest match score 0-10"
    )
    quality_score: int = Field(
        ge=0, le=10, description="Content quality score 0-10"
    )
    reasoning: str = Field(
        description="1-2 sentence explanation of scores"
    )


def build_categorization_prompt(
    article_title: str,
    article_text: str,
    existing_categories: list[str],
    category_hierarchy: dict[str, list[str]] | None = None,
) -> str:
    """Build prompt for LLM categorization of article.

    Args:
        article_title: Article title
        article_text: Article content (will be truncated to 2000 chars)
        existing_categories: List of known categories to reuse
        category_hierarchy: Optional parent->children hierarchy to inform category selection

    Returns:
        Prompt string for categorization
    """
    # Truncate article text
    truncated_text = article_text[:2000] if article_text else ""

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
            hierarchy_section = f"""

**Category hierarchy (assign new categories as children of these parents when appropriate):**
{chr(10).join(hierarchy_lines)}
"""

    prompt = f"""Categorize this article into 1-4 topic categories.

**Rules (follow strictly):**
1. ONLY categorize the article's PRIMARY topics — what the article is fundamentally about.
2. IGNORE incidental mentions, anecdotes, metaphors, and examples used to illustrate a point.
3. REUSE existing categories from the list below. Strongly prefer existing categories.
4. Category names should be human-readable English (e.g., "Artificial Intelligence", "Web Development", "Open Source"). Do NOT use kebab-case, underscores, or slashes. Even if the article is in another language, always use English category names.
5. Keep categories BROAD. Use "AI" not "AI-Assisted Programming" or "Generative AI". Use "Programming" not "Python Development".
6. Only suggest a new category if NO existing category covers the article's primary topic AND the topic is likely to recur across many articles.
7. Maximum 4 categories per article. Fewer is better.
8. When suggesting a new category, suggest which existing parent it should belong under in the suggested_parent field.

**Existing categories:** {categories_list}{hierarchy_section}

**Article:**
Title: {article_title}

Content: {truncated_text}

Categorize this article now."""

    return prompt


def build_scoring_prompt(
    article_title: str,
    article_text: str,
    interests: str,
    anti_interests: str,
) -> str:
    """Build prompt for LLM interest and quality scoring.

    Args:
        article_title: Article title
        article_text: Article content (will be truncated to 3000 chars)
        interests: User's interest preferences (prose)
        anti_interests: User's anti-interest preferences (prose)

    Returns:
        Prompt string for scoring
    """
    # Truncate article text
    truncated_text = article_text[:3000] if article_text else ""

    prompt = f"""Score this article based on user preferences.

**User Interests:**
{interests if interests else "Not specified"}

**User Anti-Interests:**
{anti_interests if anti_interests else "Not specified"}

**Article:**
Title: {article_title}

Content: {truncated_text}

**Scoring Instructions:**
- Interest Score (0-10): How well does this match the user's interests?
  - 0-2: Strongly misaligned or explicitly avoided topic
  - 3-4: Somewhat misaligned or low relevance
  - 5-6: Neutral or moderate relevance
  - 7-8: Good match with interests
  - 9-10: Excellent match, highly relevant

- Quality Score (0-10): Assess content quality regardless of interest
  - 0-2: Clickbait, spam, or very low quality
  - 3-4: Poor quality or shallow content
  - 5-6: Average quality
  - 7-8: Good quality, well-written
  - 9-10: Excellent quality, insightful

Provide:
1. Interest score (0-10)
2. Quality score (0-10)
3. Brief reasoning (1-2 sentences explaining your scores)

Score this article now."""

    return prompt
