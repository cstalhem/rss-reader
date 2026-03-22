"""Content preparation utilities for LLM prompts."""

CATEGORIZATION_MAX_CHARS = 2000
SCORING_MAX_CHARS = 4000


def truncate_at_paragraph(text: str, max_chars: int) -> str:
    """Truncate text at nearest paragraph boundary before max_chars."""
    if len(text) <= max_chars:
        return text
    # Scan backward from max_chars for paragraph break
    pos = text.rfind("\n\n", 0, max_chars)
    if pos >= 0 and pos > max_chars - 500:  # found within last 500 chars
        return text[:pos].rstrip()
    # Fall back to last newline
    pos = text.rfind("\n", 0, max_chars)
    if pos > 0:
        return text[:pos].rstrip()
    # Hard cut as last resort
    return text[:max_chars]


def format_articles_block(articles: list[dict], max_chars: int) -> str:
    """Format articles for LLM batch prompt.

    articles: [{id, title, content_markdown}, ...]
    """
    parts = []
    for a in articles:
        content = truncate_at_paragraph(a["content_markdown"] or "", max_chars)
        parts.append(
            f"<article id:{a['id']}>\n"
            f"Title: {a['title']}\n"
            f"Content: {content}\n"
            f"</article>"
        )
    return "\n\n".join(parts)
