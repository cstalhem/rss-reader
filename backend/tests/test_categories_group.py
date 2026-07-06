"""Tests for the unified grouping endpoint POST /api/categories/group (ADR-0009).

The endpoint has three mutually-exclusive modes (target_parent_id,
new_parent_name, ungroup) and MUST have zero article side-effects.
"""

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models import Article, ArticleCategoryLink, Category


def _link(session: Session, article_id: int, category_id: int) -> None:
    session.add(ArticleCategoryLink(article_id=article_id, category_id=category_id))
    session.commit()


# ---------------------------------------------------------------------------
# Mode: assign to existing parent
# ---------------------------------------------------------------------------


def test_assign_to_existing_parent(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
):
    parent = make_category(display_name="Tech", slug="tech")
    ai = make_category(display_name="AI", slug="ai")
    crypto = make_category(display_name="Crypto", slug="crypto")

    resp = test_client.post(
        "/api/categories/group",
        json={
            "category_ids": [ai.id, crypto.id],
            "target_parent_id": parent.id,
        },
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()
    assert test_session.get(Category, ai.id).parent_id == parent.id
    assert test_session.get(Category, crypto.id).parent_id == parent.id


def test_assign_skips_self_parent(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
):
    """Including the target parent in category_ids skips it, moves the rest."""
    parent = make_category(display_name="Parent", slug="parent")
    child = make_category(display_name="Child", slug="child")

    resp = test_client.post(
        "/api/categories/group",
        json={
            "category_ids": [parent.id, child.id],
            "target_parent_id": parent.id,
        },
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()
    assert test_session.get(Category, parent.id).parent_id is None
    assert test_session.get(Category, child.id).parent_id == parent.id


def test_assign_rejects_non_root_target(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
):
    root = make_category(display_name="Root", slug="root")
    nested = make_category(display_name="Nested", slug="nested", parent_id=root.id)
    source = make_category(display_name="Source", slug="source")

    resp = test_client.post(
        "/api/categories/group",
        json={
            "category_ids": [source.id],
            "target_parent_id": nested.id,
        },
    )
    assert resp.status_code == 400
    assert "root category" in resp.json()["detail"].lower()
    test_session.expire_all()
    assert test_session.get(Category, source.id).parent_id is None


def test_assign_rejects_moving_parent_with_children(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
):
    """One-level invariant: a category with children can't be nested."""
    root = make_category(display_name="Root", slug="root")
    has_child = make_category(display_name="HasChild", slug="haschild")
    make_category(display_name="Grandchild", slug="grandchild", parent_id=has_child.id)

    resp = test_client.post(
        "/api/categories/group",
        json={
            "category_ids": [has_child.id],
            "target_parent_id": root.id,
        },
    )
    assert resp.status_code == 400
    assert "children" in resp.json()["detail"].lower()
    test_session.expire_all()
    assert test_session.get(Category, has_child.id).parent_id is None


# ---------------------------------------------------------------------------
# Mode: create new parent and assign (atomic)
# ---------------------------------------------------------------------------


def test_create_and_assign_atomic(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
):
    ai = make_category(display_name="AI", slug="ai")
    crypto = make_category(display_name="Crypto", slug="crypto")

    resp = test_client.post(
        "/api/categories/group",
        json={
            "category_ids": [ai.id, crypto.id],
            "new_parent_name": "Tech",
        },
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    new_parent = test_session.exec(
        select(Category).where(Category.slug == "tech")
    ).first()
    assert new_parent is not None
    assert new_parent.parent_id is None
    assert test_session.get(Category, ai.id).parent_id == new_parent.id
    assert test_session.get(Category, crypto.id).parent_id == new_parent.id


def test_create_and_assign_clears_alias(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
):
    """New parent reuses create semantics: an existing discard alias is cleared."""
    from backend.models import CategoryAlias

    test_session.add(CategoryAlias(alias_slug="tech", target_id=None))
    test_session.commit()
    ai = make_category(display_name="AI", slug="ai")

    resp = test_client.post(
        "/api/categories/group",
        json={"category_ids": [ai.id], "new_parent_name": "Tech"},
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()
    alias = test_session.exec(
        select(CategoryAlias).where(CategoryAlias.alias_slug == "tech")
    ).first()
    assert alias is None


# ---------------------------------------------------------------------------
# Mode: ungroup
# ---------------------------------------------------------------------------


def test_ungroup_detaches_to_root(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
):
    parent = make_category(display_name="Tech", slug="tech")
    ai = make_category(display_name="AI", slug="ai", parent_id=parent.id)
    crypto = make_category(display_name="Crypto", slug="crypto", parent_id=parent.id)

    resp = test_client.post(
        "/api/categories/group",
        json={"category_ids": [ai.id, crypto.id], "ungroup": True},
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()
    assert test_session.get(Category, ai.id).parent_id is None
    assert test_session.get(Category, crypto.id).parent_id is None
    # Parent itself untouched
    assert test_session.get(Category, parent.id).parent_id is None


# ---------------------------------------------------------------------------
# Mutual-exclusivity validation (422)
# ---------------------------------------------------------------------------


def test_zero_modes_422(
    test_client: TestClient, make_category: Callable[..., Category]
):
    ai = make_category(display_name="AI", slug="ai")
    resp = test_client.post(
        "/api/categories/group",
        json={"category_ids": [ai.id]},
    )
    assert resp.status_code == 422


def test_multiple_modes_422(
    test_client: TestClient, make_category: Callable[..., Category]
):
    parent = make_category(display_name="Tech", slug="tech")
    ai = make_category(display_name="AI", slug="ai")
    resp = test_client.post(
        "/api/categories/group",
        json={
            "category_ids": [ai.id],
            "target_parent_id": parent.id,
            "ungroup": True,
        },
    )
    assert resp.status_code == 422


def test_ungroup_false_counts_as_zero_modes_422(
    test_client: TestClient, make_category: Callable[..., Category]
):
    """ungroup: false is not a mode — it must not satisfy the one-mode rule."""
    ai = make_category(display_name="AI", slug="ai")
    resp = test_client.post(
        "/api/categories/group",
        json={"category_ids": [ai.id], "ungroup": False},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Invariant: grouping NEVER touches article scoring
# ---------------------------------------------------------------------------


def test_group_has_zero_article_side_effects(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article: Callable[..., Article],
    make_feed,
):
    feed = make_feed()
    parent = make_category(display_name="Tech", slug="tech")
    ai = make_category(display_name="AI", slug="ai", weight="boost")
    crypto = make_category(
        display_name="Crypto", slug="crypto", weight="block", needs_triage=True
    )

    a1 = make_article(
        feed.id, scoring_state="scored", composite_score=7.5, interest_score=6
    )
    a2 = make_article(feed.id, scoring_state="blocked", composite_score=0.0)
    _link(test_session, a1.id, ai.id)
    _link(test_session, a2.id, crypto.id)

    before = {
        a.id: (a.scoring_state, a.composite_score, a.interest_score, a.quality_score)
        for a in test_session.exec(select(Article)).all()
    }

    resp = test_client.post(
        "/api/categories/group",
        json={"category_ids": [ai.id, crypto.id], "target_parent_id": parent.id},
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    after = {
        a.id: (a.scoring_state, a.composite_score, a.interest_score, a.quality_score)
        for a in test_session.exec(select(Article)).all()
    }
    assert after == before
