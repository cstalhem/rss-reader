from backend.markdown import html_to_markdown


def test_strips_images():
    html = '<p>Text <img src="photo.jpg" alt="pic"/> here</p>'
    result = html_to_markdown(html)
    assert "img" not in result
    assert "photo.jpg" not in result
    assert "Text" in result
    assert "here" in result


def test_strips_links_keeps_text():
    html = '<p>Visit <a href="https://example.com">Example Site</a> now</p>'
    result = html_to_markdown(html)
    assert "https://example.com" not in result
    assert "Example Site" in result


def test_strips_scripts_and_styles():
    html = "<p>Hello</p><script>alert('xss')</script><style>.x{color:red}</style>"
    result = html_to_markdown(html)
    assert "script" not in result.lower()
    assert "style" not in result.lower()
    assert "alert" not in result
    assert "Hello" in result


def test_headings_atx_style():
    html = "<h2>My Heading</h2><p>Body text</p>"
    result = html_to_markdown(html)
    assert "## My Heading" in result
    assert "Body text" in result


def test_empty_string():
    assert html_to_markdown("") == ""


def test_none_like_edge_cases():
    # Whitespace-only input
    assert html_to_markdown("   ") == ""
    # Tags that produce no text
    assert html_to_markdown("<img src='x.png'/>") == ""
