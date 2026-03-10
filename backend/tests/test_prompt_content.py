from backend.prompts.content import (
    CATEGORIZATION_MAX_CHARS,
    SCORING_MAX_CHARS,
    format_articles_block,
    truncate_at_paragraph,
)

# --- truncate_at_paragraph ---


def test_truncate_short_text_passes_through():
    text = "Hello world"
    assert truncate_at_paragraph(text, 100) == text


def test_truncate_at_paragraph_boundary():
    # Paragraph break at position 80, max_chars=100 → truncates at paragraph
    block1 = "A" * 78
    block2 = "B" * 50
    text = block1 + "\n\n" + block2
    result = truncate_at_paragraph(text, 100)
    assert result == block1


def test_truncate_paragraph_too_far_back_falls_to_newline():
    # For small max_chars, paragraph break is always within 500 chars of the end,
    # so we need a large max_chars where the paragraph is > 500 chars before it.
    paragraph_pos = 100
    text2 = "A" * paragraph_pos + "\n\n" + "B" * 800 + "\n" + "C" * 200
    # max_chars = 1000, paragraph at 100, 1000-500=500, 100 < 500 → skip paragraph
    # newline at 100+2+800 = 902, 902 > 0 → use newline
    result2 = truncate_at_paragraph(text2, 1000)
    assert result2 == "A" * paragraph_pos + "\n\n" + "B" * 800


def test_truncate_no_breaks_hard_cut():
    text = "A" * 200
    result = truncate_at_paragraph(text, 100)
    assert result == "A" * 100


def test_truncate_strips_trailing_whitespace():
    text = "Hello   \n\n" + "B" * 200
    result = truncate_at_paragraph(text, 10)
    # \n\n at pos 8, max_chars=10, 8 > 10-500=-490 → use paragraph
    assert result == "Hello"
    assert not result.endswith(" ")


# --- format_articles_block ---


def test_format_single_article():
    articles = [{"id": 42, "title": "Test Title", "content_markdown": "Some content"}]
    result = format_articles_block(articles, max_chars=4000)
    assert result == (
        "<article id:42>\n"
        "Title: Test Title\n"
        "Content: Some content\n"
        "</article>"
    )


def test_format_multiple_articles():
    articles = [
        {"id": 1, "title": "First", "content_markdown": "AAA"},
        {"id": 2, "title": "Second", "content_markdown": "BBB"},
    ]
    result = format_articles_block(articles, max_chars=4000)
    assert "\n\n" in result
    parts = result.split("\n\n")
    assert len(parts) == 2
    assert "<article id:1>" in parts[0]
    assert "<article id:2>" in parts[1]


def test_format_truncates_content():
    long_content = "A" * 200
    articles = [{"id": 1, "title": "T", "content_markdown": long_content}]
    result = format_articles_block(articles, max_chars=100)
    # Content should be truncated to 100 chars
    content_line = [line for line in result.split("\n") if line.startswith("Content:")][0]
    content_value = content_line[len("Content: "):]
    assert len(content_value) == 100


def test_format_handles_none_content():
    articles = [{"id": 1, "title": "T", "content_markdown": None}]
    result = format_articles_block(articles, max_chars=4000)
    assert "Content: \n" in result


# --- constants ---


def test_constants_exist():
    assert CATEGORIZATION_MAX_CHARS == 2000
    assert SCORING_MAX_CHARS == 4000
