"""Tests for auto-group suggest + apply endpoints."""

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import Category
from backend.prompts.grouping import (
    GroupingResponse,
    GroupSuggestion,
    build_grouping_prompt,
)

# --- build_grouping_prompt ---


class TestBuildGroupingPrompt:
    def test_includes_all_category_names(self):
        _system, user = build_grouping_prompt(["AI", "Programming", "Science"], {})
        assert "- AI" in user
        assert "- Programming" in user
        assert "- Science" in user

    def test_includes_existing_groups(self):
        _system, user = build_grouping_prompt(
            ["AI", "Programming", "Technology"],
            {"Technology": ["AI", "Programming"]},
        )
        assert "Technology > AI, Programming" in user

    def test_omits_existing_groups_section_when_empty(self):
        _system, user = build_grouping_prompt(["AI", "Science"], {})
        assert "Current groups" not in user

    def test_categories_sorted_alphabetically(self):
        _system, user = build_grouping_prompt(["Zebra", "Alpha", "Middle"], {})
        alpha_pos = user.index("- Alpha")
        middle_pos = user.index("- Middle")
        zebra_pos = user.index("- Zebra")
        assert alpha_pos < middle_pos < zebra_pos

    def test_grouping_response_schema(self):
        data = {
            "groups": [
                {"parent": "Tech", "children": ["AI", "Programming"]},
            ]
        }
        resp = GroupingResponse.model_validate(data)
        assert len(resp.groups) == 1
        assert resp.groups[0].parent == "Tech"

    def test_grouping_response_empty_groups(self):
        resp = GroupingResponse.model_validate({"groups": []})
        assert resp.groups == []


# --- POST /api/categories/auto-group/apply ---


class TestAutoGroupApply:
    def test_basic_apply(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """Apply groups to ungrouped categories."""
        tech = make_category(display_name="Technology", slug="technology")
        ai = make_category(display_name="AI", slug="ai")
        prog = make_category(display_name="Programming", slug="programming")
        science = make_category(display_name="Science", slug="science")
        space = make_category(display_name="Space", slug="space")

        response = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [
                    {"parent": "Technology", "children": ["AI", "Programming"]},
                    {"parent": "Science", "children": ["Space"]},
                ]
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["groups_applied"] == 2
        assert body["categories_moved"] == 3

        test_session.refresh(ai)
        test_session.refresh(prog)
        test_session.refresh(space)
        assert ai.parent_id == tech.id
        assert prog.parent_id == tech.id
        assert space.parent_id == science.id

    def test_flattens_existing_groups_before_regrouping(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """Existing parent-child relationships are dissolved before new groups applied."""
        old_parent = make_category(
            display_name="Old Parent", slug="old-parent", weight="boost"
        )
        child = make_category(
            display_name="Child", slug="child", parent_id=old_parent.id
        )
        new_parent = make_category(display_name="New Parent", slug="new-parent")

        response = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [
                    {"parent": "New Parent", "children": ["Child"]},
                ]
            },
        )
        assert response.status_code == 200

        test_session.refresh(child)
        assert child.parent_id == new_parent.id
        # Groups are display-only (ADR-0001): regrouping never changes weights
        assert child.weight == "normal"

    def test_regrouping_never_changes_weights(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """A child's own weight survives flatten + regroup untouched."""
        parent = make_category(display_name="Parent", slug="parent", weight="boost")
        child = make_category(
            display_name="Child",
            slug="child",
            parent_id=parent.id,
            weight="reduce",
        )
        make_category(display_name="New Parent", slug="new-parent")

        response = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [{"parent": "New Parent", "children": ["Child"]}],
            },
        )
        assert response.status_code == 200

        test_session.refresh(child)
        assert child.weight == "reduce"

    def test_duplicate_child_across_groups_counted_once(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """A child appearing in multiple groups is assigned to the first and counted once."""
        group_a = make_category(display_name="Group A", slug="group-a")
        make_category(display_name="Group B", slug="group-b")
        shared = make_category(display_name="Shared", slug="shared")
        other = make_category(display_name="Other", slug="other")

        response = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [
                    {"parent": "Group A", "children": ["Shared", "Other"]},
                    {"parent": "Group B", "children": ["Shared"]},
                ]
            },
        )
        assert response.status_code == 200
        body = response.json()
        # Shared counted once (assigned to Group A), Other counted once
        assert body["categories_moved"] == 2
        assert body["groups_applied"] == 1  # Group B has 0 moved → not counted

        test_session.refresh(shared)
        test_session.refresh(other)
        assert shared.parent_id == group_a.id  # First assignment wins
        assert other.parent_id == group_a.id

    def test_never_creates_depth_two_trees(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """Chained groups (A > B, then B > C) must not nest C under a child.

        A group whose parent was already assigned as a child is skipped
        entirely (first-wins), keeping the hierarchy one level deep.
        """
        a = make_category(display_name="A", slug="a")
        b = make_category(display_name="B", slug="b")
        c = make_category(display_name="C", slug="c")

        response = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [
                    {"parent": "A", "children": ["B"]},
                    {"parent": "B", "children": ["C"]},
                ]
            },
        )
        assert response.status_code == 200

        test_session.refresh(a)
        test_session.refresh(b)
        test_session.refresh(c)
        assert b.parent_id == a.id
        assert c.parent_id is None  # group with used-as-child parent skipped
        # No category has a parent that itself has a parent (max depth 1)
        by_id = {cat.id: cat for cat in (a, b, c)}
        for cat in by_id.values():
            if cat.parent_id is not None:
                assert by_id[cat.parent_id].parent_id is None

    def test_parent_slug_never_reassigned_as_child(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """A slug already used as a parent keeps its children; a later group
        listing it as a child skips that assignment (first-wins)."""
        a = make_category(display_name="A", slug="a")
        b = make_category(display_name="B", slug="b")
        c = make_category(display_name="C", slug="c")

        response = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [
                    {"parent": "B", "children": ["C"]},
                    {"parent": "A", "children": ["B"]},
                ]
            },
        )
        assert response.status_code == 200

        test_session.refresh(a)
        test_session.refresh(b)
        test_session.refresh(c)
        assert c.parent_id == b.id  # B keeps its children
        assert b.parent_id is None  # second assignment of B skipped
        assert a.parent_id is None

    def test_skips_nonexistent_category_names(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """Groups referencing non-existent categories are silently skipped."""
        real = make_category(display_name="Real", slug="real")

        response = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [
                    {"parent": "Ghost Parent", "children": ["Real"]},
                    {"parent": "Real", "children": ["Ghost Child"]},
                ]
            },
        )
        assert response.status_code == 200
        body = response.json()
        # Neither group could be fully applied
        assert body["groups_applied"] == 0
        assert body["categories_moved"] == 0

        test_session.refresh(real)
        assert real.parent_id is None

    def test_skips_self_reference(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """A category listed as both parent and child is skipped."""
        cat = make_category(display_name="SelfRef", slug="selfref")
        other = make_category(display_name="Other", slug="other")

        response = test_client.post(
            "/api/categories/auto-group/apply",
            json={
                "groups": [
                    {"parent": "SelfRef", "children": ["SelfRef", "Other"]},
                ]
            },
        )
        assert response.status_code == 200
        body = response.json()
        # SelfRef skipped, but Other moved
        assert body["categories_moved"] == 1

        test_session.refresh(cat)
        test_session.refresh(other)
        assert cat.parent_id is None
        assert other.parent_id == cat.id


# --- POST /api/categories/auto-group/suggest ---


class TestAutoGroupSuggest:
    def test_suggest_returns_groups(
        self,
        test_client: TestClient,
        fake_llm,
        make_category: Callable[..., Category],
    ):
        """Suggest endpoint calls the wrapper and returns filtered groups."""
        make_category(display_name="Technology", slug="technology")
        make_category(display_name="AI", slug="ai")
        make_category(display_name="Machine Learning", slug="machine-learning")
        make_category(display_name="Science", slug="science")

        # LLM returns non-canonical casing — response should use DB display_name
        fake_llm.queue(
            "grouping",
            GroupingResponse(
                groups=[
                    GroupSuggestion(
                        parent="technology", children=["ai", "machine learning"]
                    ),
                    # References non-existent categories — should be filtered out
                    GroupSuggestion(parent="Science", children=["Physics", "Biology"]),
                ]
            ),
        )

        response = test_client.post("/api/categories/auto-group/suggest")

        assert response.status_code == 200
        body = response.json()
        # Only valid group returned, with canonical DB display names
        assert len(body["groups"]) == 1
        assert body["groups"][0]["parent"] == "Technology"
        assert body["groups"][0]["children"] == ["AI", "Machine Learning"]
        assert fake_llm.calls[0]["task"] == "grouping"

    def test_suggest_rejects_fewer_than_2_categories(
        self,
        test_client: TestClient,
        fake_llm,
        make_category: Callable[..., Category],
    ):
        """Need at least 2 categories to suggest groups."""
        make_category(display_name="Lonely", slug="lonely")

        response = test_client.post("/api/categories/auto-group/suggest")
        assert response.status_code == 400
        assert "at least 2" in response.json()["detail"].lower()
