"""Tests for category batch-move safety constraints."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import Category


def _create_category(
    session: Session,
    display_name: str,
    slug: str,
    parent_id: int | None = None,
) -> Category:
    category = Category(
        display_name=display_name,
        slug=slug,
        parent_id=parent_id,
        is_seen=True,
    )
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


def test_batch_move_skips_self_parent_id(
    test_client: TestClient,
    test_session: Session,
):
    """Including target parent in category_ids should skip it and move the rest."""
    parent = _create_category(test_session, "Parent", "parent")
    child = _create_category(test_session, "Child", "child")

    response = test_client.post(
        "/api/categories/batch-move",
        json={
            "category_ids": [parent.id, child.id],
            "target_parent_id": parent.id,
        },
    )
    assert response.status_code == 200
    assert response.json()["updated"] == 1

    test_session.refresh(parent)
    test_session.refresh(child)
    assert parent.parent_id is None
    assert child.parent_id == parent.id


def test_batch_move_rejects_non_root_target(
    test_client: TestClient,
    test_session: Session,
):
    """Target must remain root-only for move operations."""
    root = _create_category(test_session, "Root", "root")
    nested_target = _create_category(
        test_session,
        "Nested Target",
        "nested-target",
        parent_id=root.id,
    )
    source = _create_category(test_session, "Source", "source")

    response = test_client.post(
        "/api/categories/batch-move",
        json={
            "category_ids": [source.id],
            "target_parent_id": nested_target.id,
        },
    )
    assert response.status_code == 400
    assert "root category" in response.json()["detail"].lower()

    test_session.refresh(source)
    assert source.parent_id is None
