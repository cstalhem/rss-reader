"""Tests for batch response models used as Azure structured-output schemas."""

from backend.prompts.categorization import (
    ArticleCategoryResult,
    BatchCategoryResponse,
    build_categorization_schema,
)
from backend.prompts.grouping import GroupingResponse
from backend.prompts.scoring import ArticleScoringResult, BatchScoringResponse


class TestArticleCategoryResult:
    def test_valid_data(self):
        result = ArticleCategoryResult(
            article_id=42,
            categories=["Technology", "AI"],
            proposed_category="Robotics",
        )
        assert result.article_id == 42
        assert result.categories == ["Technology", "AI"]
        assert result.proposed_category == "Robotics"


class TestBatchCategoryResponse:
    def test_parses_from_dict(self):
        data = {
            "results": [
                {
                    "article_id": 1,
                    "categories": ["Tech"],
                    "proposed_category": None,
                },
                {
                    "article_id": 2,
                    "categories": ["Science"],
                    "proposed_category": "Quantum",
                },
            ]
        }
        resp = BatchCategoryResponse.model_validate(data)
        assert len(resp.results) == 2
        assert resp.results[0].article_id == 1
        assert resp.results[1].proposed_category == "Quantum"


class TestArticleScoringResult:
    def test_valid_data(self):
        result = ArticleScoringResult(
            article_id=7,
            interest_score=8,
            quality_score=6,
            reasoning="Good match with user interests.",
        )
        assert result.article_id == 7
        assert result.interest_score == 8
        assert result.quality_score == 6


class TestBatchScoringResponse:
    def test_parses_from_dict(self):
        data = {
            "results": [
                {
                    "article_id": 1,
                    "interest_score": 7,
                    "quality_score": 8,
                    "reasoning": "Great",
                },
                {
                    "article_id": 2,
                    "interest_score": 3,
                    "quality_score": 5,
                    "reasoning": "Meh",
                },
            ]
        }
        resp = BatchScoringResponse.model_validate(data)
        assert len(resp.results) == 2
        assert resp.results[0].interest_score == 7

    def test_round_trip_json_schema(self):
        schema = BatchScoringResponse.model_json_schema()
        assert "properties" in schema
        assert "results" in schema["properties"]
        # Verify the schema references ArticleScoringResult
        assert "$defs" in schema or "$ref" in str(schema)


class TestStrictSchemaCompatibility:
    """Azure strict structured outputs reject constraint keywords and defaults.

    Response models must stay free of them — limits live in prompts and
    are clamped in workers instead.
    """

    UNSUPPORTED_KEYWORDS = (
        "minimum",
        "maximum",
        "minItems",
        "maxItems",
        "minLength",
        "maxLength",
        "default",
    )

    def _assert_clean(self, model):
        schema_str = str(model.model_json_schema())
        for keyword in self.UNSUPPORTED_KEYWORDS:
            assert f"'{keyword}'" not in schema_str, (
                f"{model.__name__} schema contains strict-mode-unsupported "
                f"keyword '{keyword}'"
            )

    def test_batch_scoring_schema_is_strict_compatible(self):
        self._assert_clean(BatchScoringResponse)

    def test_batch_category_schema_is_strict_compatible(self):
        self._assert_clean(BatchCategoryResponse)

    def test_dynamic_category_schema_is_strict_compatible(self):
        # The per-batch enum schema must also stay free of constraint keywords.
        schema = build_categorization_schema(["AI", "Programming"])
        self._assert_clean(schema)

    def test_grouping_schema_is_strict_compatible(self):
        self._assert_clean(GroupingResponse)
