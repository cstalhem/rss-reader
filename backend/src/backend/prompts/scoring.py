"""LLM prompt templates and response schemas for article scoring."""

from pydantic import BaseModel, Field


class ScoringResponse(BaseModel):
    """Response schema for article interest scoring."""

    interest_score: int = Field(ge=0, le=10, description="Interest match score 0-10")
    quality_score: int = Field(ge=0, le=10, description="Content quality score 0-10")
    reasoning: str = Field(description="1-2 sentence explanation of scores")


class ArticleScoringResult(BaseModel):
    """Single article result within a batch scoring response."""

    article_id: int
    interest_score: int = Field(ge=0, le=10)
    quality_score: int = Field(ge=0, le=10)
    reasoning: str


class BatchScoringResponse(BaseModel):
    """Batch response containing scoring results for multiple articles."""

    results: list[ArticleScoringResult]


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

**User Interests:**
{interests if interests else "Not specified"}

**User Anti-Interests:**
{anti_interests if anti_interests else "Not specified"}

**Article:**
Title: {article_title}

Content: {truncated_text}

Score this article now."""

    return prompt


def build_batch_scoring_prompt(
    articles: list[dict],
    interests: str,
    anti_interests: str,
) -> tuple[str, str]:
    """Build system prompt and user message for batch scoring.

    Args:
        articles: List of dicts with keys: id, title, content_markdown
        interests: User's interest preferences (prose)
        anti_interests: User's anti-interest preferences (prose)

    Returns:
        Tuple of (system_prompt, user_message)
    """
    from backend.prompts.content import SCORING_MAX_CHARS, format_articles_block

    system_prompt = f"""Score articles based on user preferences.

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

For each article provide:
1. Interest score (0-10)
2. Quality score (0-10)
3. Brief reasoning (1-2 sentences explaining your scores)

**User Interests:**
{interests if interests else "Not specified"}

**User Anti-Interests:**
{anti_interests if anti_interests else "Not specified"}

You will receive multiple articles wrapped in `<article>` tags. Return a JSON object with a `results` array. Each entry must include the `article_id` from the input."""

    user_message = format_articles_block(articles, max_chars=SCORING_MAX_CHARS)

    return system_prompt, user_message
