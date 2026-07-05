"""Tests for GET /api/articles/counts (issue #94).

The core invariant: every count must equal the row count of the matching
list-endpoint query, and the global `unread` count must equal the sum of
`unread_count` across GET /api/feeds (single definition of "unread").
"""

from fastapi.testclient import TestClient


def _seed_mixed_articles(make_feed, make_article):
    """Seed one feed with a mix of scoring states.

    - 2 unread scored articles with composite_score > 0
    - 1 read scored article with composite_score > 0
    - 1 unread scored article with composite_score == 0 (should NOT count as unread)
    - 1 pending (queued categorization) article
    - 1 blocked article
    - 1 failed article
    """
    feed = make_feed()
    unread_scored = [
        make_article(
            feed.id,
            is_read=False,
            scoring_state="scored",
            categorization_state="categorized",
            composite_score=5.0,
        )
        for _ in range(2)
    ]
    read_scored = make_article(
        feed.id,
        is_read=True,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=5.0,
    )
    zero_score_unread = make_article(
        feed.id,
        is_read=False,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=0.0,
    )
    pending = make_article(
        feed.id,
        is_read=False,
        scoring_state="unscored",
        categorization_state="queued",
        composite_score=None,
    )
    blocked = make_article(
        feed.id,
        is_read=False,
        scoring_state="blocked",
        categorization_state="categorized",
        composite_score=0.0,
    )
    return feed, {
        "unread_scored": unread_scored,
        "read_scored": read_scored,
        "zero_score_unread": zero_score_unread,
        "pending": pending,
        "blocked": blocked,
    }


def test_counts_match_list_query_rows(test_client: TestClient, make_feed, make_article):
    """Each count equals the number of rows the matching list query returns."""
    _seed_mixed_articles(make_feed, make_article)

    counts = test_client.get("/api/articles/counts").json()

    # The list endpoint's is_read filter alone doesn't exclude score==0 articles
    # (that's a display nuance, not the unread *count* definition) — so the
    # matching list query for the "unread" count also asserts composite_score > 0.
    unread_list = test_client.get("/api/articles", params={"is_read": "false"}).json()
    unread_rows = [
        item for item in unread_list["items"] if (item["composite_score"] or 0) > 0
    ]
    read_list = test_client.get("/api/articles", params={"is_read": "true"}).json()
    read_rows = [
        item for item in read_list["items"] if (item["composite_score"] or 0) > 0
    ]
    pending_list = test_client.get(
        "/api/articles", params={"scoring_state": "pending"}
    ).json()
    blocked_list = test_client.get(
        "/api/articles", params={"scoring_state": "blocked"}
    ).json()

    assert counts["unread"] == len(unread_rows)
    assert counts["read"] == len(read_rows)
    assert counts["scoring"] == len(pending_list["items"])
    assert counts["blocked"] == len(blocked_list["items"])

    # Explicit expected values given the seeded mix.
    assert counts["unread"] == 2  # zero-score article excluded
    assert counts["read"] == 1
    assert counts["scoring"] == 1
    assert counts["blocked"] == 1


def test_counts_scoped_by_feed_id(test_client: TestClient, make_feed, make_article):
    """feed_id scopes counts the same way it scopes the list endpoint."""
    feed_a = make_feed()
    feed_b = make_feed()
    make_article(
        feed_a.id,
        is_read=False,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=5.0,
    )
    make_article(
        feed_b.id,
        is_read=False,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=5.0,
    )

    counts_a = test_client.get(
        "/api/articles/counts", params={"feed_id": feed_a.id}
    ).json()
    list_a = test_client.get(
        "/api/articles", params={"feed_id": feed_a.id, "is_read": "false"}
    ).json()

    assert counts_a["unread"] == 1
    assert counts_a["unread"] == len(list_a["items"])


def test_counts_scoped_by_folder_id(
    test_client: TestClient, make_feed, make_article, test_session
):
    """folder_id scopes counts the same way it scopes the list endpoint (join through Feed)."""
    folder_response = test_client.post(
        "/api/feed-folders", json={"name": "Tech", "feed_ids": []}
    )
    folder_id = folder_response.json()["id"]

    feed_in_folder = make_feed(folder_id=folder_id)
    feed_outside = make_feed()

    make_article(
        feed_in_folder.id,
        is_read=False,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=5.0,
    )
    make_article(
        feed_outside.id,
        is_read=False,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=5.0,
    )

    counts = test_client.get(
        "/api/articles/counts", params={"folder_id": folder_id}
    ).json()
    list_scoped = test_client.get(
        "/api/articles", params={"folder_id": folder_id, "is_read": "false"}
    ).json()

    assert counts["unread"] == 1
    assert counts["unread"] == len(list_scoped["items"])


def test_global_unread_count_matches_sum_of_feed_unread_counts(
    test_client: TestClient, make_feed, make_article
):
    """Invariant: counts endpoint's global unread == sum of unread_count across GET /api/feeds."""
    _seed_mixed_articles(make_feed, make_article)
    # A second feed with its own unread article to make the sum non-trivial.
    feed_two = make_feed()
    make_article(
        feed_two.id,
        is_read=False,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=3.0,
    )

    counts = test_client.get("/api/articles/counts").json()
    feeds = test_client.get("/api/feeds").json()

    assert counts["unread"] == sum(feed["unread_count"] for feed in feeds)
