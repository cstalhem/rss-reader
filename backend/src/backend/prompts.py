"""LLM prompt templates and response schemas for content curation."""

from pydantic import BaseModel, Field

# Default seed categories to bootstrap the system
DEFAULT_CATEGORIES = [
    "technology",
    "science",
    "politics",
    "business",
    "finance",
    "health",
    "sports",
    "entertainment",
    "culture",
    "gaming",
    "programming",
    "ai/ml",
    "cybersecurity",
    "climate",
    "space",
    "education",
    "food",
    "travel",
    "design",
    "music",
    "film",
    "philosophy",
    "history",
    "law",
    "startups",
]


class CategoryResponse(BaseModel):
    """Response schema for article categorization."""

    categories: list[str] = Field(
        description="1-6 topic categories from existing list",
        max_length=10,
    )
    suggested_new: list[str] = Field(
        default=[],
        description="New categories not in existing list (suggest sparingly)",
        max_length=3,
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
) -> str:
    """Build prompt for LLM categorization of article.

    Args:
        article_title: Article title
        article_text: Article content (will be truncated to 2000 chars)
        existing_categories: List of known categories to reuse

    Returns:
        Prompt string for categorization
    """
    # Truncate article text
    truncated_text = article_text[:2000] if article_text else ""

    # Format existing categories
    categories_list = ", ".join(sorted(existing_categories))

    prompt = f"""Categorize this article into 1-6 topic categories.

**Instructions:**
- Choose from the existing categories list below (reuse these whenever possible)
- Normalize all categories to lowercase
- Only suggest new categories if none of the existing ones fit well
- Maximum 6 categories per article
- Return categories that accurately describe the article's main topics

**Existing categories:** {categories_list}

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
