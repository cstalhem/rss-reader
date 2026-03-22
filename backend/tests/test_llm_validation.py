"""Tests for the shared LLM response validation helper."""

import pytest
from pydantic import BaseModel, Field

from backend.llm_providers.base import LLMValidationError, validate_llm_response


class ScoreModel(BaseModel):
    """Minimal model for testing validation constraints."""

    score: int = Field(ge=0, le=10)
    label: str


class TestValidateLlmResponse:
    def test_valid_json(self):
        result = validate_llm_response('{"score": 5, "label": "good"}', ScoreModel)
        assert result.score == 5
        assert result.label == "good"

    def test_none_raises_retryable(self):
        with pytest.raises(LLMValidationError) as exc_info:
            validate_llm_response(None, ScoreModel)
        assert exc_info.value.is_retryable is True
        assert exc_info.value.raw_response is None

    def test_empty_string_raises_retryable(self):
        with pytest.raises(LLMValidationError) as exc_info:
            validate_llm_response("", ScoreModel)
        assert exc_info.value.is_retryable is True

    def test_whitespace_only_raises_retryable(self):
        with pytest.raises(LLMValidationError) as exc_info:
            validate_llm_response("   \n\t  ", ScoreModel)
        assert exc_info.value.is_retryable is True

    def test_malformed_json_raises_retryable(self):
        raw = '{"score": 5, "label": '
        with pytest.raises(LLMValidationError) as exc_info:
            validate_llm_response(raw, ScoreModel)
        assert exc_info.value.is_retryable is True
        assert exc_info.value.raw_response == raw

    def test_schema_violation_raises_non_retryable(self):
        """Valid JSON but score=15 violates ge=0, le=10 constraint."""
        raw = '{"score": 15, "label": "too high"}'
        with pytest.raises(LLMValidationError) as exc_info:
            validate_llm_response(raw, ScoreModel)
        assert exc_info.value.is_retryable is False
        assert exc_info.value.raw_response == raw

    def test_missing_field_raises_non_retryable(self):
        """Valid JSON but missing required field."""
        raw = '{"score": 5}'
        with pytest.raises(LLMValidationError) as exc_info:
            validate_llm_response(raw, ScoreModel)
        assert exc_info.value.is_retryable is False

    def test_long_response_truncated_in_message(self):
        raw = '{"score": 15, "label": "' + "x" * 1000 + '"}'
        with pytest.raises(LLMValidationError) as exc_info:
            validate_llm_response(raw, ScoreModel)
        # Full raw preserved on attribute
        assert len(exc_info.value.raw_response) > 500
        # Message is truncated
        assert len(str(exc_info.value)) < len(exc_info.value.raw_response)

    def test_exception_chaining(self):
        with pytest.raises(LLMValidationError) as exc_info:
            validate_llm_response("not json", ScoreModel)
        assert exc_info.value.__cause__ is not None
        assert exc_info.value.original_exc is not None
