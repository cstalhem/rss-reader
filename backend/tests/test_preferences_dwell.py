"""API-seam tests for the mark_read_dwell_seconds preference (issue #101).

The dwell threshold gating the marked_read auto-mark is runtime-tunable in
General settings. Bounds are 1..60s; changing it must NOT trigger rescoring
(unlike interests/anti_interests).
"""

from fastapi.testclient import TestClient


def test_dwell_default_exposed_in_get(test_client: TestClient):
    prefs = test_client.get("/api/preferences").json()
    assert prefs["mark_read_dwell_seconds"] == 5


def test_dwell_update_persists(test_client: TestClient):
    response = test_client.put("/api/preferences", json={"mark_read_dwell_seconds": 12})
    assert response.status_code == 200
    assert response.json()["mark_read_dwell_seconds"] == 12

    assert test_client.get("/api/preferences").json()["mark_read_dwell_seconds"] == 12


def test_dwell_below_min_rejected(test_client: TestClient):
    response = test_client.put("/api/preferences", json={"mark_read_dwell_seconds": 0})
    assert response.status_code == 422


def test_dwell_above_max_rejected(test_client: TestClient):
    response = test_client.put("/api/preferences", json={"mark_read_dwell_seconds": 61})
    assert response.status_code == 422


def test_dwell_change_does_not_trigger_rescoring(test_client: TestClient, monkeypatch):
    called = False

    def _spy(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(
        "backend.scheduler.categorization_worker.enqueue_recent_for_rescoring",
        _spy,
    )

    response = test_client.put("/api/preferences", json={"mark_read_dwell_seconds": 20})
    assert response.status_code == 200
    assert called is False
