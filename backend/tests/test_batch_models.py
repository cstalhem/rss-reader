"""Tests for batch response models used in batch scoring/categorization."""

import pytest
from pydantic import ValidationError

from backend.prompts.categorization import ArticleCategoryResult, BatchCategoryResponse
from backend.prompts.scoring import ArticleScoringResult, BatchScoringResponse


class TestArticleCategoryResult:
    def test_valid_data(self):
        result = ArticleCategoryResult(
            article_id=42,
            categories=["Technology", "AI"],
            suggested_new=["Robotics"],
        )
        assert result.article_id == 42
        assert result.categories == ["Technology", "AI"]
        assert result.suggested_new == ["Robotics"]

    def test_max_4_categories_enforced(self):
        with pytest.raises(ValidationError):
            ArticleCategoryResult(
                article_id=1,
                categories=["A", "B", "C", "D", "E"],
            )

    def test_defaults(self):
        result = ArticleCategoryResult(article_id=1, categories=["Tech"])
        assert result.suggested_new == []
        assert result.suggested_parent is None


class TestBatchCategoryResponse:
    def test_parses_from_dict(self):
        data = {
            "results": [
                {"article_id": 1, "categories": ["Tech"]},
                {"article_id": 2, "categories": ["Science"], "suggested_new": ["Quantum"]},
            ]
        }
        resp = BatchCategoryResponse.model_validate(data)
        assert len(resp.results) == 2
        assert resp.results[0].article_id == 1
        assert resp.results[1].suggested_new == ["Quantum"]


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

    def test_score_bounds(self):
        with pytest.raises(ValidationError):
            ArticleScoringResult(
                article_id=1, interest_score=11, quality_score=5, reasoning="x"
            )
        with pytest.raises(ValidationError):
            ArticleScoringResult(
                article_id=1, interest_score=5, quality_score=-1, reasoning="x"
            )


class TestBatchScoringResponse:
    def test_parses_from_dict(self):
        data = {
            "results": [
                {"article_id": 1, "interest_score": 7, "quality_score": 8, "reasoning": "Great"},
                {"article_id": 2, "interest_score": 3, "quality_score": 5, "reasoning": "Meh"},
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
