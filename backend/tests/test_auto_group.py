"""Tests for auto-group suggest + apply endpoints."""

from collections.abc import Callable
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.deps import TaskRuntimeResolution
from backend.models import Category
from backend.prompts.grouping import (
    GroupingResponse,
    GroupSuggestion,
    build_grouping_prompt,
)

MOCK_RUNTIME = TaskRuntimeResolution(
    task="categorization",
    provider="ollama",
    model="test-model",
    endpoint="http://localhost:11434",
    thinking=False,
    api_key=None,
    ready=True,
    reason=None,
)


# --- Cycle 1: build_grouping_prompt ---


class TestBuildGroupingPrompt:
    def test_includes_all_category_names(self):
        prompt = build_grouping_prompt(["AI", "Programming", "Science"], {})
        assert "- AI" in prompt
        assert "- Programming" in prompt
        assert "- Science" in prompt

    def test_includes_existing_groups_with_incomplete_framing(self):
        prompt = build_grouping_prompt(
            ["AI", "Programming", "Technology"],
            {"Technology": ["AI", "Programming"]},
        )
        assert "Technology > AI, Programming" in prompt
        assert "incomplete" in prompt.lower()
        assert "not yet assigned" in prompt.lower()

    def test_omits_existing_groups_section_when_empty(self):
        prompt = build_grouping_prompt(["AI", "Science"], {})
        assert "Current groups" not in prompt

    def test_categories_sorted_alphabetically(self):
        prompt = build_grouping_prompt(["Zebra", "Alpha", "Middle"], {})
        alpha_pos = prompt.index("- Alpha")
        middle_pos = prompt.index("- Middle")
        zebra_pos = prompt.index("- Zebra")
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

    def test_build_theme_proposal_prompt_includes_all_categories(self):
        from backend.prompts.grouping import build_theme_proposal_prompt

        prompt = build_theme_proposal_prompt(["AI", "Programming", "Science"])
        assert "- AI" in prompt
        assert "- Programming" in prompt
        assert "- Science" in prompt
        assert "Current groups" not in prompt  # No anchoring on existing groups

    def test_build_theme_proposal_prompt_categories_sorted(self):
        from backend.prompts.grouping import build_theme_proposal_prompt

        prompt = build_theme_proposal_prompt(["Zebra", "Alpha", "Middle"])
        alpha_pos = prompt.index("- Alpha")
        middle_pos = prompt.index("- Middle")
        zebra_pos = prompt.index("- Zebra")
        assert alpha_pos < middle_pos < zebra_pos

    def test_build_assignment_prompt_includes_categories_and_themes(self):
        from backend.prompts.grouping import build_assignment_prompt

        prompt = build_assignment_prompt(
            ["AI", "Programming", "Science"], ["Technology", "Research"]
        )
        assert "- AI" in prompt
        assert "- Programming" in prompt
        assert "- Science" in prompt
        assert "Technology" in prompt
        assert "Research" in prompt
        # Structural rules carried over
        assert "at least two children" in prompt.lower()

    def test_build_assignment_prompt_no_existing_children(self):
        from backend.prompts.grouping import build_assignment_prompt

        prompt = build_assignment_prompt(["AI", "Programming"], ["Tech"])
        # The ">" format is used in build_grouping_prompt for existing group children
        # Assignment prompt should NOT show pre-existing assignments
        assert ">" not in prompt or prompt.count(">") == 0


class TestThemeResponse:
    def test_theme_response_schema(self):
        from backend.prompts.grouping import ThemeResponse

        data = {"themes": ["Technology", "Science", "Culture"]}
        resp = ThemeResponse.model_validate(data)
        assert len(resp.themes) == 3
        assert resp.themes[0] == "Technology"

    def test_theme_response_requires_themes(self):
        import pytest

        from backend.prompts.grouping import ThemeResponse

        with pytest.raises(ValueError):
            ThemeResponse.model_validate({})


# --- Cycle 2: POST /api/categories/auto-group/apply ---


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
        # Child should have inherited weight from old parent during flatten
        assert child.weight == "boost"

    def test_preserves_explicit_weight_on_flatten(
        self,
        test_client: TestClient,
        test_session: Session,
        make_category: Callable[..., Category],
    ):
        """Child with explicit weight keeps it after flatten, not overwritten by parent."""
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
        assert child.weight == "reduce"  # Keeps explicit weight

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

    # --- Cycle 3: Edge cases ---

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


# --- Cycle 4: POST /api/categories/auto-group/suggest ---


class TestAutoGroupSuggest:
    def test_suggest_returns_groups(
        self,
        test_client: TestClient,
        make_category: Callable[..., Category],
    ):
        """Suggest endpoint calls provider and returns filtered groups."""
        make_category(display_name="Technology", slug="technology")
        make_category(display_name="AI", slug="ai")
        make_category(display_name="Machine Learning", slug="machine-learning")
        make_category(display_name="Science", slug="science")

        # LLM returns non-canonical casing — response should use DB display_name
        mock_response = GroupingResponse(
            groups=[
                GroupSuggestion(
                    parent="technology", children=["ai", "machine learning"]
                ),
                # This one references non-existent categories — should be filtered out
                GroupSuggestion(parent="Science", children=["Physics", "Biology"]),
            ]
        )

        with (
            patch(
                "backend.routers.categories.resolve_task_runtime",
                return_value=MOCK_RUNTIME,
            ),
            patch("backend.routers.categories.get_provider") as mock_get_provider,
        ):
            mock_provider = AsyncMock()
            mock_provider.suggest_groups.return_value = mock_response
            mock_get_provider.return_value = mock_provider

            response = test_client.post(
                "/api/categories/auto-group/suggest",
                json={},
            )

        assert response.status_code == 200
        body = response.json()
        # Only valid group returned, with canonical DB display names
        assert len(body["groups"]) == 1
        assert body["groups"][0]["parent"] == "Technology"
        assert body["groups"][0]["children"] == ["AI", "Machine Learning"]

    # --- Cycle 5: <2 categories → 400 ---

    def test_suggest_rejects_fewer_than_2_categories(
        self,
        test_client: TestClient,
        make_category: Callable[..., Category],
    ):
        """Need at least 2 non-hidden categories to suggest groups."""
        make_category(display_name="Lonely", slug="lonely")

        response = test_client.post(
            "/api/categories/auto-group/suggest",
            json={},
        )
        assert response.status_code == 400
        assert "at least 2" in response.json()["detail"].lower()

    def test_suggest_excludes_hidden_from_count(
        self,
        test_client: TestClient,
        make_category: Callable[..., Category],
    ):
        """Hidden categories don't count toward the minimum."""
        make_category(display_name="Visible", slug="visible")
        make_category(display_name="Hidden", slug="hidden", is_hidden=True)

        response = test_client.post(
            "/api/categories/auto-group/suggest",
            json={},
        )
        assert response.status_code == 400

    def test_suggest_allows_new_parent_names(
        self,
        test_client: TestClient,
        make_category: Callable[..., Category],
    ):
        """Groups with novel parent names (not in DB) should pass through."""
        make_category(display_name="AI", slug="ai")
        make_category(display_name="Programming", slug="programming")
        make_category(display_name="Science", slug="science")

        mock_response = GroupingResponse(
            groups=[
                GroupSuggestion(
                    parent="Technology", children=["AI", "Programming"]
                ),
            ]
        )

        with (
            patch(
                "backend.routers.categories.resolve_task_runtime",
                return_value=MOCK_RUNTIME,
            ),
            patch("backend.routers.categories.get_provider") as mock_get_provider,
        ):
            mock_provider = AsyncMock()
            mock_provider.suggest_groups.return_value = mock_response
            mock_get_provider.return_value = mock_provider

            response = test_client.post(
                "/api/categories/auto-group/suggest",
                json={},
            )

        assert response.status_code == 200
        body = response.json()
        assert len(body["groups"]) == 1
        assert body["groups"][0]["parent"] == "Technology"
        assert set(body["groups"][0]["children"]) == {"AI", "Programming"}

    def test_suggest_deduplicates_children_across_groups(
        self,
        test_client: TestClient,
        make_category: Callable[..., Category],
    ):
        """A child claimed by multiple groups should only appear in the first."""
        make_category(display_name="AI", slug="ai")
        make_category(display_name="ML", slug="ml")
        make_category(display_name="Robotics", slug="robotics")

        mock_response = GroupingResponse(
            groups=[
                GroupSuggestion(parent="Tech", children=["AI", "ML"]),
                GroupSuggestion(parent="Engineering", children=["AI", "Robotics"]),
            ]
        )

        with (
            patch(
                "backend.routers.categories.resolve_task_runtime",
                return_value=MOCK_RUNTIME,
            ),
            patch("backend.routers.categories.get_provider") as mock_get_provider,
        ):
            mock_provider = AsyncMock()
            mock_provider.suggest_groups.return_value = mock_response
            mock_get_provider.return_value = mock_provider

            response = test_client.post(
                "/api/categories/auto-group/suggest",
                json={},
            )

        assert response.status_code == 200
        groups = response.json()["groups"]
        assert len(groups) == 2
        assert groups[0]["children"] == ["AI", "ML"]
        # AI should NOT appear in the second group
        assert groups[1]["children"] == ["Robotics"]
