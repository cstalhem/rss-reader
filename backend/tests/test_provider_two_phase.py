"""Tests for two-phase suggest_groups in LLM providers."""

from unittest.mock import AsyncMock, patch

import pytest

from backend.llm_providers.base import ProviderTaskConfig
from backend.prompts.grouping import (
    GroupingResponse,
    GroupSuggestion,
    ThemeResponse,
)

MOCK_CONFIG = ProviderTaskConfig(
    endpoint="http://localhost",
    model="test-model",
    thinking=False,
    api_key="test-key",
)


class TestGoogleTwoPhase:
    @pytest.mark.asyncio
    async def test_suggest_groups_calls_two_phases(self):
        """suggest_groups should call _generate twice: ThemeResponse then GroupingResponse."""
        from backend.llm_providers.google import GoogleProvider

        provider = GoogleProvider()

        theme_response = ThemeResponse(themes=["Tech", "Science"])
        grouping_response = GroupingResponse(
            groups=[GroupSuggestion(parent="Tech", children=["AI", "ML"])]
        )

        with patch.object(provider, "_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = [theme_response, grouping_response]

            result = await provider.suggest_groups(
                all_categories=["AI", "ML", "Biology"],
                existing_groups={},
                config=MOCK_CONFIG,
            )

        assert mock_gen.call_count == 2
        # First call should use ThemeResponse schema
        assert mock_gen.call_args_list[0].args[-1] is ThemeResponse
        # Second call should use GroupingResponse schema
        assert mock_gen.call_args_list[1].args[-1] is GroupingResponse
        assert result == grouping_response
