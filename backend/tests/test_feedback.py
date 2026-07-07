"""API-seam tests for issue #101: feedback capture.

Covers the rating projection + event log (PUT /api/articles/{id}/rating),
the marked_read transition event in PATCH, and the rescued transition event.
Every rating change writes both the mutable projection and an append-only
FeedbackEvent; behavioral events are emitted only on genuine state transitions.
"""

from datetime import datetime

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models import Article, FeedbackEvent


def _events(session: Session, article_id: int, event_type: str) -> list[FeedbackEvent]:
    return list(
        session.exec(
            select(FeedbackEvent)
            .where(FeedbackEvent.article_id == article_id)
            .where(FeedbackEvent.event_type == event_type)
            .order_by(FeedbackEvent.id)  # pyright: ignore[reportArgumentType]
        ).all()
    )


# ---------------------------------------------------------------------------
# Rating: projection + rated event log
# ---------------------------------------------------------------------------


def test_rating_set_positive_sets_column_and_logs_one_event(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id)

    response = test_client.put(f"/api/articles/{article.id}/rating", json={"value": 1})

    assert response.status_code == 200
    assert response.json()["rating"] == 1

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.rating == 1

    events = _events(test_session, article.id, "rated")
    assert len(events) == 1
    assert events[0].value == 1


def test_rating_change_logs_second_event(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id)

    test_client.put(f"/api/articles/{article.id}/rating", json={"value": 1})
    response = test_client.put(f"/api/articles/{article.id}/rating", json={"value": -1})

    assert response.status_code == 200
    assert response.json()["rating"] == -1

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.rating == -1

    events = _events(test_session, article.id, "rated")
    assert [e.value for e in events] == [1, -1]


def test_rating_clear_logs_null_event_and_nulls_column(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id)

    test_client.put(f"/api/articles/{article.id}/rating", json={"value": 1})
    response = test_client.put(
        f"/api/articles/{article.id}/rating", json={"value": None}
    )

    assert response.status_code == 200
    assert response.json()["rating"] is None

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.rating is None

    events = _events(test_session, article.id, "rated")
    # first the +1, then the clear (value NULL) — a distinct signal from "never rated".
    assert [e.value for e in events] == [1, None]


def test_rating_no_op_same_value_logs_nothing(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id)

    test_client.put(f"/api/articles/{article.id}/rating", json={"value": 1})
    response = test_client.put(f"/api/articles/{article.id}/rating", json={"value": 1})

    assert response.status_code == 200
    assert response.json()["rating"] == 1

    test_session.expire_all()
    events = _events(test_session, article.id, "rated")
    assert len(events) == 1


def test_rating_no_op_null_on_unrated_logs_nothing(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id)

    response = test_client.put(
        f"/api/articles/{article.id}/rating", json={"value": None}
    )

    assert response.status_code == 200
    assert response.json()["rating"] is None

    test_session.expire_all()
    assert _events(test_session, article.id, "rated") == []


def test_rating_invalid_value_422(test_client: TestClient, make_feed, make_article):
    feed = make_feed()
    article = make_article(feed.id)

    response = test_client.put(f"/api/articles/{article.id}/rating", json={"value": 2})
    assert response.status_code == 422


def test_rating_unknown_article_404(test_client: TestClient):
    response = test_client.put("/api/articles/999999/rating", json={"value": 1})
    assert response.status_code == 404


def test_rating_present_in_detail_and_list(
    test_client: TestClient, make_feed, make_article
):
    feed = make_feed()
    article = make_article(feed.id)

    test_client.put(f"/api/articles/{article.id}/rating", json={"value": -1})

    detail = test_client.get(f"/api/articles/{article.id}").json()
    assert detail["rating"] == -1

    listing = test_client.get("/api/articles").json()
    item = next(i for i in listing["items"] if i["id"] == article.id)
    assert item["rating"] == -1


# ---------------------------------------------------------------------------
# marked_read: false->true transition only
# ---------------------------------------------------------------------------


def test_mark_read_transition_logs_event(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id, is_read=False)

    response = test_client.patch(f"/api/articles/{article.id}", json={"is_read": True})
    assert response.status_code == 200

    test_session.expire_all()
    assert len(_events(test_session, article.id, "marked_read")) == 1


def test_re_patch_already_read_logs_nothing(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id, is_read=False)

    test_client.patch(f"/api/articles/{article.id}", json={"is_read": True})
    test_client.patch(f"/api/articles/{article.id}", json={"is_read": True})

    test_session.expire_all()
    assert len(_events(test_session, article.id, "marked_read")) == 1


def test_unread_transition_logs_nothing(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id, is_read=True)

    test_client.patch(f"/api/articles/{article.id}", json={"is_read": False})

    test_session.expire_all()
    assert _events(test_session, article.id, "marked_read") == []


def test_mark_all_read_logs_no_marked_read_events(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    a1 = make_article(feed.id, is_read=False)
    a2 = make_article(feed.id, is_read=False)
    a3 = make_article(feed.id, is_read=False)

    response = test_client.post("/api/articles/mark-all-read")
    assert response.status_code == 200

    test_session.expire_all()
    all_events = list(
        test_session.exec(
            select(FeedbackEvent).where(FeedbackEvent.event_type == "marked_read")
        ).all()
    )
    assert all_events == []
    # sanity: the articles were actually marked read
    for a in (a1, a2, a3):
        assert test_session.get(Article, a.id).is_read is True


# ---------------------------------------------------------------------------
# rescued: block->visible transition only (branch 1)
# ---------------------------------------------------------------------------


def test_rescue_blocked_logs_event(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id, scoring_state="blocked", composite_score=0.0)

    response = test_client.post(f"/api/articles/{article.id}/rescue")
    assert response.status_code == 200

    test_session.expire_all()
    assert len(_events(test_session, article.id, "rescued")) == 1


def test_double_rescue_logs_one_event(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(feed.id, scoring_state="blocked", composite_score=0.0)

    test_client.post(f"/api/articles/{article.id}/rescue")
    test_client.post(f"/api/articles/{article.id}/rescue")

    test_session.expire_all()
    assert len(_events(test_session, article.id, "rescued")) == 1


def test_rescue_failed_rescored_logs_no_event(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(
        feed.id,
        scoring_state="failed",
        categorization_state="categorized",
        rescued_at=datetime.now(),
        scoring_attempts=3,
        composite_score=None,
    )

    test_client.post(f"/api/articles/{article.id}/rescue")

    test_session.expire_all()
    assert _events(test_session, article.id, "rescued") == []
