import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import Article


def test_root(test_client: TestClient):
    """Test health check endpoint."""
    response = test_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_list_articles_empty(test_client: TestClient):
    """Test listing articles when database is empty."""
    response = test_client.get("/api/articles")
    assert response.status_code == 200
    assert response.json() == []


def test_list_articles_with_data(test_client: TestClient, sample_articles):
    """Test listing articles returns them sorted by published_at desc."""
    response = test_client.get("/api/articles")
    assert response.status_code == 200

    articles = response.json()
    assert len(articles) == 3

    # Check ordering: Recent -> Older -> Read (by published_at desc)
    assert articles[0]["title"] == "Recent Article"
    assert articles[1]["title"] == "Older Article"
    assert articles[2]["title"] == "Read Article"

    # Check read status
    assert articles[0]["is_read"] is False
    assert articles[2]["is_read"] is True


def test_list_articles_pagination(test_client: TestClient, sample_articles):
    """Test pagination parameters."""
    # Get first article only
    response = test_client.get("/api/articles?limit=1")
    assert response.status_code == 200
    articles = response.json()
    assert len(articles) == 1
    assert articles[0]["title"] == "Recent Article"

    # Skip first article
    response = test_client.get("/api/articles?skip=1&limit=1")
    assert response.status_code == 200
    articles = response.json()
    assert len(articles) == 1
    assert articles[0]["title"] == "Older Article"


def test_list_articles_filter_unread(test_client: TestClient, sample_articles):
    """Test filtering articles by is_read=false (unread only)."""
    response = test_client.get("/api/articles?is_read=false")
    assert response.status_code == 200

    articles = response.json()
    assert len(articles) == 2

    # Should return only unread articles
    assert articles[0]["title"] == "Recent Article"
    assert articles[0]["is_read"] is False
    assert articles[1]["title"] == "Older Article"
    assert articles[1]["is_read"] is False


def test_list_articles_filter_read(test_client: TestClient, sample_articles):
    """Test filtering articles by is_read=true (read only)."""
    response = test_client.get("/api/articles?is_read=true")
    assert response.status_code == 200

    articles = response.json()
    assert len(articles) == 1

    # Should return only read articles
    assert articles[0]["title"] == "Read Article"
    assert articles[0]["is_read"] is True


def test_list_articles_no_filter(test_client: TestClient, sample_articles):
    """Test that omitting is_read filter returns all articles."""
    response = test_client.get("/api/articles")
    assert response.status_code == 200

    articles = response.json()
    assert len(articles) == 3

    # Should return all articles
    titles = {article["title"] for article in articles}
    assert titles == {"Recent Article", "Older Article", "Read Article"}


def test_get_article_success(test_client: TestClient, sample_articles):
    """Test getting a single article by ID."""
    article_id = sample_articles[0].id

    response = test_client.get(f"/api/articles/{article_id}")
    assert response.status_code == 200

    article = response.json()
    assert article["id"] == article_id
    assert article["title"] == "Recent Article"
    assert article["content"] == "Full content of recent article"
    assert "author" in article
    assert "published_at" in article


def test_get_article_not_found(test_client: TestClient):
    """Test getting a non-existent article returns 404."""
    response = test_client.get("/api/articles/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_mark_article_read(test_client: TestClient, sample_articles, test_session: Session):
    """Test marking an article as read."""
    article_id = sample_articles[0].id
    assert sample_articles[0].is_read is False

    # Mark as read
    response = test_client.patch(
        f"/api/articles/{article_id}",
        json={"is_read": True}
    )
    assert response.status_code == 200

    article = response.json()
    assert article["is_read"] is True

    # Verify persistence in database
    db_article = test_session.get(Article, article_id)
    test_session.refresh(db_article)
    assert db_article.is_read is True


def test_mark_article_unread(test_client: TestClient, sample_articles, test_session: Session):
    """Test marking an article as unread."""
    article_id = sample_articles[2].id  # This one is already read
    assert sample_articles[2].is_read is True

    # Mark as unread
    response = test_client.patch(
        f"/api/articles/{article_id}",
        json={"is_read": False}
    )
    assert response.status_code == 200

    article = response.json()
    assert article["is_read"] is False

    # Verify persistence in database
    db_article = test_session.get(Article, article_id)
    test_session.refresh(db_article)
    assert db_article.is_read is False


def test_update_article_not_found(test_client: TestClient):
    """Test updating a non-existent article returns 404."""
    response = test_client.patch(
        "/api/articles/99999",
        json={"is_read": True}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_refresh_feed(test_client: TestClient, sample_feed):
    """Test manual feed refresh endpoint."""
    # Note: This test will attempt to fetch a real feed if the URL is reachable
    # For a fully isolated test, we would mock the httpx client
    response = test_client.post("/api/feeds/refresh")
    assert response.status_code == 200

    data = response.json()
    assert "message" in data
    assert "new_articles" in data
    assert isinstance(data["new_articles"], int)


def test_refresh_feed_no_feeds(test_client: TestClient):
    """Test refresh endpoint with no feeds configured."""
    response = test_client.post("/api/feeds/refresh")
    assert response.status_code == 200

    data = response.json()
    assert data["message"] == "No feeds configured"
    assert data["new_articles"] == 0
