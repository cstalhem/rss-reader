"""Acceptance-criteria tests for issue #91's additive category API surface.

Covers the bulk collection PATCH (triage gestures), the needs_triage
list filter, the read-only alias listing, block short-circuit visibility
after a bulk weight change, and the invariant that regrouping (auto-group
apply, batch-move) touches only parent_id — never weights or article links.
"""

from collections.abc import Callable
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models import Article, ArticleCategoryLink, Category
from backend.scoring import is_blocked

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _link(session: Session, article_id: int, category_id: int) -> None:
    session.add(ArticleCategoryLink(article_id=article_id, category_id=category_id))
    session.commit()


def _links(session: Session) -> set[tuple[int, int]]:
    rows = session.exec(select(ArticleCategoryLink)).all()
    return {(row.article_id, row.category_id) for row in rows}


def _weights(session: Session) -> dict[int, tuple[str, bool]]:
    cats = session.exec(select(Category)).all()
    return {c.id: (c.weight, c.needs_triage) for c in cats}


# ---------------------------------------------------------------------------
# Bulk collection PATCH
# ---------------------------------------------------------------------------


class TestBulkPatch:
    def test_weight_only_updates_all_in_one_call(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        cats = [make_category() for _ in range(3)]

        resp = test_client.patch(
            "/api/categories",
            json={"category_ids": [c.id for c in cats], "weight": "reduce"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert body["updated"] == 3
        assert body["missing_ids"] == []

        test_session.expire_all()
        for cat in cats:
            fresh = test_session.get(Category, cat.id)
            assert fresh.weight == "reduce"
            # weight-only PATCH must not touch triage state
            assert fresh.needs_triage is False

    def test_needs_triage_only_keep_gesture(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        cats = [make_category(needs_triage=True) for _ in range(2)]

        resp = test_client.patch(
            "/api/categories",
            json={"category_ids": [c.id for c in cats], "needs_triage": False},
        )
        assert resp.status_code == 200
        assert resp.json()["updated"] == 2

        test_session.expire_all()
        for cat in cats:
            fresh = test_session.get(Category, cat.id)
            assert fresh.needs_triage is False
            # keep gesture must not touch weight
            assert fresh.weight == "normal"

    def test_both_fields_batch_block_gesture(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        cats = [make_category(needs_triage=True) for _ in range(2)]

        resp = test_client.patch(
            "/api/categories",
            json={
                "category_ids": [c.id for c in cats],
                "weight": "block",
                "needs_triage": False,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["updated"] == 2

        test_session.expire_all()
        for cat in cats:
            fresh = test_session.get(Category, cat.id)
            assert fresh.weight == "block"
            assert fresh.needs_triage is False

    def test_missing_ids_reported_while_existing_update(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        cat = make_category()

        resp = test_client.patch(
            "/api/categories",
            json={"category_ids": [cat.id, 9999, 8888], "weight": "boost"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["updated"] == 1
        assert sorted(body["missing_ids"]) == [8888, 9999]

        test_session.expire_all()
        assert test_session.get(Category, cat.id).weight == "boost"

    def test_no_fields_provided_422(
        self,
        test_client: TestClient,
        make_category: Callable[..., Category],
    ):
        cat = make_category()

        resp = test_client.patch("/api/categories", json={"category_ids": [cat.id]})
        assert resp.status_code == 422

    def test_invalid_weight_422(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        cat = make_category()

        resp = test_client.patch(
            "/api/categories",
            json={"category_ids": [cat.id], "weight": "banished"},
        )
        assert resp.status_code == 422

        test_session.expire_all()
        assert test_session.get(Category, cat.id).weight == "normal"


# ---------------------------------------------------------------------------
# Triage list filter
# ---------------------------------------------------------------------------


class TestTriageListFilter:
    @pytest.fixture(name="triage_setup")
    def triage_setup_fixture(
        self, test_session, make_category, make_article, make_feed
    ):
        feed = make_feed()
        flagged = make_category(needs_triage=True)
        settled = make_category(needs_triage=False)
        article = make_article(feed.id)
        _link(test_session, article.id, flagged.id)
        return flagged, settled

    def test_needs_triage_true_returns_only_flagged_with_counts(
        self, test_client: TestClient, triage_setup
    ):
        flagged, _settled = triage_setup

        resp = test_client.get("/api/categories", params={"needs_triage": True})
        assert resp.status_code == 200
        items = resp.json()
        assert [item["id"] for item in items] == [flagged.id]
        assert items[0]["needs_triage"] is True
        assert items[0]["article_count"] == 1

    def test_needs_triage_false_returns_the_rest(
        self, test_client: TestClient, triage_setup
    ):
        _flagged, settled = triage_setup

        resp = test_client.get("/api/categories", params={"needs_triage": False})
        assert resp.status_code == 200
        items = resp.json()
        assert [item["id"] for item in items] == [settled.id]
        assert items[0]["article_count"] == 0

    def test_no_param_returns_all(self, test_client: TestClient, triage_setup):
        flagged, settled = triage_setup

        resp = test_client.get("/api/categories")
        assert resp.status_code == 200
        assert {item["id"] for item in resp.json()} == {flagged.id, settled.id}


# ---------------------------------------------------------------------------
# Alias listing
# ---------------------------------------------------------------------------


class TestAliasListing:
    def test_lists_redirect_and_discard_aliases(
        self,
        test_client: TestClient,
        make_category: Callable[..., Category],
    ):
        source = make_category(display_name="ML", slug="ml")
        target = make_category(display_name="AI", slug="ai")
        junk = make_category(display_name="Junk", slug="junk")

        # Merge leaves a redirect alias ml -> AI
        resp = test_client.post(
            "/api/categories/merge",
            json={"source_id": source.id, "target_id": target.id},
        )
        assert resp.status_code == 200

        # Delete leaves a discard alias junk -> None
        resp = test_client.delete(f"/api/categories/{junk.id}")
        assert resp.status_code == 200

        resp = test_client.get("/api/categories/aliases")
        assert resp.status_code == 200
        aliases = {item["alias_slug"]: item for item in resp.json()}
        assert set(aliases) == {"ml", "junk"}

        redirect = aliases["ml"]
        assert redirect["target_id"] == target.id
        assert redirect["target_display_name"] == "AI"
        assert redirect["id"] is not None
        assert datetime.fromisoformat(redirect["created_at"])

        discard = aliases["junk"]
        assert discard["target_id"] is None
        assert discard["target_display_name"] is None

    def test_empty_when_no_aliases(self, test_client: TestClient):
        resp = test_client.get("/api/categories/aliases")
        assert resp.status_code == 200
        assert resp.json() == []


# ---------------------------------------------------------------------------
# Block short-circuit visibility after bulk PATCH
# ---------------------------------------------------------------------------


class TestBlockShortCircuitAfterBulkPatch:
    @pytest.mark.asyncio
    async def test_bulk_blocked_category_routes_article_to_blocked_view(
        self, test_client, test_session, sample_feed, fake_llm, make_category
    ):
        from backend.prompts import ArticleCategoryResult, BatchCategoryResponse
        from backend.scoring_queue import CategorizationWorker, ScoringWorker

        crypto = make_category(display_name="Crypto", slug="crypto")

        # Block via the bulk collection PATCH (batch-block gesture)
        resp = test_client.patch(
            "/api/categories",
            json={
                "category_ids": [crypto.id],
                "weight": "block",
                "needs_triage": False,
            },
        )
        assert resp.status_code == 200
        test_session.expire_all()
        assert is_blocked([test_session.get(Category, crypto.id)])

        article = Article(
            feed_id=sample_feed.id,
            title="Coin of the day",
            url="https://example.com/coin",
            published_at=datetime.now(),
            content="Content",
            categorization_state="queued",
            scoring_state="unscored",
        )
        test_session.add(article)
        test_session.commit()
        test_session.refresh(article)

        fake_llm.queue(
            "categorization",
            BatchCategoryResponse(
                results=[
                    ArticleCategoryResult(
                        article_id=article.id,
                        categories=["Crypto"],
                        proposed_category=None,
                    )
                ]
            ),
        )

        await CategorizationWorker().process_next_batch(test_session, 5)
        await ScoringWorker().process_next_batch(test_session, 5)
        test_session.expire_all()

        # Hidden from the default list, inspectable in the blocked view
        assert test_client.get("/api/articles").json() == []
        blocked = test_client.get(
            "/api/articles", params={"scoring_state": "blocked"}
        ).json()
        assert len(blocked) == 1
        assert blocked[0]["id"] == article.id
        assert blocked[0]["scoring_state"] == "blocked"


# ---------------------------------------------------------------------------
# Regrouping changes nothing (except parent_id)
# ---------------------------------------------------------------------------


class TestRegroupingChangesNothing:
    @pytest.fixture(name="grouping_setup")
    def grouping_setup_fixture(
        self, test_session, make_category, make_article, make_feed
    ):
        feed = make_feed()
        tech = make_category(display_name="Tech", slug="tech", weight="boost")
        ai = make_category(display_name="AI", slug="ai", weight="max")
        crypto = make_category(
            display_name="Crypto", slug="crypto", weight="block", needs_triage=True
        )
        chess = make_category(display_name="Chess", slug="chess", weight="reduce")

        a1 = make_article(feed.id)
        a2 = make_article(feed.id, scoring_state="blocked")
        _link(test_session, a1.id, ai.id)
        _link(test_session, a2.id, crypto.id)

        return {"tech": tech, "ai": ai, "crypto": crypto, "chess": chess}

    def test_auto_group_apply_touches_only_parent_id(
        self, test_client: TestClient, test_session: Session, grouping_setup
    ):
        cats = grouping_setup
        weights_before = _weights(test_session)
        links_before = _links(test_session)
        blocked_before = {
            cid: is_blocked([test_session.get(Category, cid)]) for cid in weights_before
        }

        resp = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [
                    {"parent": "Tech", "children": ["AI", "Crypto"]},
                ]
            },
        )
        assert resp.status_code == 200
        assert resp.json()["categories_moved"] == 2
        test_session.expire_all()

        # Only parent_id moved
        assert test_session.get(Category, cats["ai"].id).parent_id == cats["tech"].id
        assert (
            test_session.get(Category, cats["crypto"].id).parent_id == cats["tech"].id
        )
        assert test_session.get(Category, cats["chess"].id).parent_id is None

        # Weights, triage flags, blocked state, and article links unchanged
        assert _weights(test_session) == weights_before
        assert _links(test_session) == links_before
        for cid, was_blocked in blocked_before.items():
            assert is_blocked([test_session.get(Category, cid)]) == was_blocked

    def test_batch_move_touches_only_parent_id(
        self, test_client: TestClient, test_session: Session, grouping_setup
    ):
        cats = grouping_setup
        weights_before = _weights(test_session)
        links_before = _links(test_session)

        resp = test_client.post(
            "/api/categories/batch-move",
            json={
                "category_ids": [cats["ai"].id, cats["chess"].id],
                "target_parent_id": cats["tech"].id,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["updated"] == 2
        test_session.expire_all()

        assert test_session.get(Category, cats["ai"].id).parent_id == cats["tech"].id
        assert test_session.get(Category, cats["chess"].id).parent_id == cats["tech"].id

        assert _weights(test_session) == weights_before
        assert _links(test_session) == links_before
