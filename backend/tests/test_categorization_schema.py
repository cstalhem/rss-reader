"""Unit tests for the per-batch categorization schema factory (ADR-0006).

Pure — no DB, no client. The schema is built dynamically from the current
vocabulary: `categories` is `list[Literal[*display_names]]` (a closed enum),
falling back to `list[str]` when the vocabulary is empty. `proposed_category`
is the single required-but-nullable proposal channel.
"""

import pydantic
import pytest

from backend.prompts.categorization import build_categorization_schema


class TestClosedVocabularyEnforcement:
    """Acceptance criterion 1: out-of-vocabulary assignment is unrepresentable."""

    def test_in_vocabulary_category_validates(self):
        schema = build_categorization_schema(["AI", "Programming"])
        resp = schema.model_validate(
            {
                "results": [
                    {"article_id": 1, "categories": ["AI"], "proposed_category": None}
                ]
            }
        )
        assert resp.results[0].categories == ["AI"]

    def test_out_of_vocabulary_category_rejected(self):
        schema = build_categorization_schema(["AI", "Programming"])
        with pytest.raises(pydantic.ValidationError):
            schema.model_validate(
                {
                    "results": [
                        {
                            "article_id": 1,
                            "categories": ["Blockchain"],
                            "proposed_category": None,
                        }
                    ]
                }
            )


class TestEmptyVocabularyFallback:
    """Empty vocabulary degrades to list[str] so the batch never deadlocks."""

    def test_empty_vocabulary_accepts_arbitrary_strings(self):
        schema = build_categorization_schema([])
        resp = schema.model_validate(
            {
                "results": [
                    {
                        "article_id": 1,
                        "categories": ["Anything", "Goes"],
                        "proposed_category": None,
                    }
                ]
            }
        )
        assert resp.results[0].categories == ["Anything", "Goes"]


class TestProposalChannel:
    """proposed_category is a single required-but-nullable string field."""

    def test_proposed_category_accepts_string(self):
        schema = build_categorization_schema(["AI"])
        resp = schema.model_validate(
            {
                "results": [
                    {
                        "article_id": 1,
                        "categories": [],
                        "proposed_category": "Retro Computing",
                    }
                ]
            }
        )
        assert resp.results[0].proposed_category == "Retro Computing"

    def test_proposed_category_accepts_none(self):
        schema = build_categorization_schema(["AI"])
        resp = schema.model_validate(
            {
                "results": [
                    {"article_id": 1, "categories": [], "proposed_category": None}
                ]
            }
        )
        assert resp.results[0].proposed_category is None

    def test_proposed_category_is_required(self):
        # Required-but-nullable: the key must be present (framing proposal as
        # the deliberate exception path, per ADR-0006).
        schema = build_categorization_schema(["AI"])
        with pytest.raises(pydantic.ValidationError):
            schema.model_validate({"results": [{"article_id": 1, "categories": []}]})
