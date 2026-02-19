"""Smoke tests for all router endpoints. Validates wiring after router split."""

from fastapi.testclient import TestClient


def test_health(test_client: TestClient):
    """GET /health -> 200, has 'status' key."""
    response = test_client.get("/health")
    assert response.status_code == 200
    assert "status" in response.json()


def test_articles_list(test_client: TestClient):
    """GET /api/articles -> 200, returns list."""
    response = test_client.get("/api/articles")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_feeds_list(test_client: TestClient):
    """GET /api/feeds -> 200, returns list."""
    response = test_client.get("/api/feeds")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_categories_list(test_client: TestClient):
    """GET /api/categories -> 200, returns list."""
    response = test_client.get("/api/categories")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_preferences_get(test_client: TestClient):
    """GET /api/preferences -> 200, has 'interests' key."""
    response = test_client.get("/api/preferences")
    assert response.status_code == 200
    data = response.json()
    assert "interests" in data


def test_scoring_status(test_client: TestClient):
    """GET /api/scoring/status -> 200, has expected keys."""
    response = test_client.get("/api/scoring/status")
    assert response.status_code == 200
    data = response.json()
    assert "scored" in data
    assert "queued" in data
    assert "phase" in data


def test_ollama_health(test_client: TestClient):
    """GET /api/ollama/health -> 200 (connected=false if Ollama not running)."""
    response = test_client.get("/api/ollama/health")
    assert response.status_code == 200
    data = response.json()
    assert "connected" in data


def test_articles_invalid_sort(test_client: TestClient):
    """GET /api/articles?sort_by=invalid -> 422 (Literal type validation)."""
    response = test_client.get("/api/articles?sort_by=invalid")
    assert response.status_code == 422
