"""Tests for triage evidence embed (issue #98 change C).

GET /api/categories?needs_triage=true embeds 2-3 sample articles per category
and created_at. The article-embed category carries needs_triage so the
frontend can render the "new" dot.
"""

from collections.abc import Callable
from datetime import datetime

from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import ArticleCategoryLink, Category


def _link(session: Session, article_id: int, category_id: int) -> None:
    session.add(ArticleCategoryLink(article_id=article_id, category_id=category_id))
    session.commit()


def test_triage_list_embeds_samples_and_created_at(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    feed = make_feed(title="Hacker News")
    flagged = make_category(display_name="AI", slug="ai", needs_triage=True)
    a1 = make_article(feed.id, title="First AI story")
    a2 = make_article(feed.id, title="Second AI story")
    _link(test_session, a1.id, flagged.id)
    _link(test_session, a2.id, flagged.id)

    resp = test_client.get("/api/categories", params={"needs_triage": True})
    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert len(items) == 1
    cat = items[0]

    assert "created_at" in cat
    assert datetime.fromisoformat(cat["created_at"])

    assert "sample_articles" in cat
    samples = cat["sample_articles"]
    assert 1 <= len(samples) <= 3
    titles = {s["title"] for s in samples}
    assert titles <= {"First AI story", "Second AI story"}
    assert all(s["feed_title"] == "Hacker News" for s in samples)


def test_triage_list_caps_samples_at_three(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    feed = make_feed()
    flagged = make_category(display_name="AI", slug="ai", needs_triage=True)
    for _ in range(5):
        art = make_article(feed.id)
        _link(test_session, art.id, flagged.id)

    resp = test_client.get("/api/categories", params={"needs_triage": True})
    assert resp.status_code == 200
    assert len(resp.json()[0]["sample_articles"]) == 3


def test_article_embed_carries_needs_triage_flag(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    feed = make_feed()
    fresh = make_category(display_name="AI", slug="ai", needs_triage=True)
    settled = make_category(display_name="Rust", slug="rust", needs_triage=False)
    article = make_article(
        feed.id, scoring_state="scored", composite_score=5.0, is_read=False
    )
    _link(test_session, article.id, fresh.id)
    _link(test_session, article.id, settled.id)

    resp = test_client.get("/api/articles")
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 1
    embeds = {c["slug"]: c for c in items[0]["categories"]}
    assert embeds["ai"]["needs_triage"] is True
    assert embeds["rust"]["needs_triage"] is False
