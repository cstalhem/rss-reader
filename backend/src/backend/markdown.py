from bs4 import BeautifulSoup
from markdownify import STRIP
from markdownify import markdownify as md

# Tags whose content should be completely removed (not just the tag wrapper)
_DECOMPOSE_TAGS = ["script", "style", "iframe", "noscript"]

# Tags to strip (remove tag, keep inner text)
_STRIP_TAGS = ["img", "a", "figure"]


def html_to_markdown(html: str) -> str:
    """Convert HTML to clean markdown for LLM consumption and reader display."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(_DECOMPOSE_TAGS):
        tag.decompose()

    return md(
        str(soup),
        heading_style="ATX",
        strip=_STRIP_TAGS,
        bullets="*",
        wrap=False,
        strip_document=STRIP,
    ).strip()
