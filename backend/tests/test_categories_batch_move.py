"""Tests for category batch-move safety constraints."""

from typing import Callable

from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import Category


def test_batch_move_skips_self_parent_id(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
):
    """Including target parent in category_ids should skip it and move the rest."""
    parent = make_category(display_name="Parent", slug="parent")
    child = make_category(display_name="Child", slug="child")

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
    make_category: Callable[..., Category],
):
    """Target must remain root-only for move operations."""
    root = make_category(display_name="Root", slug="root")
    nested_target = make_category(
        display_name="Nested Target",
        slug="nested-target",
        parent_id=root.id,
    )
    source = make_category(display_name="Source", slug="source")

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
