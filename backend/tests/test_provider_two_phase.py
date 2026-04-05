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

    @pytest.mark.asyncio
    async def test_empty_themes_returns_empty_grouping(self):
        """If Phase 1 returns no themes, short-circuit with empty groups."""
        from backend.llm_providers.google import GoogleProvider

        provider = GoogleProvider()

        with patch.object(provider, "_generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = ThemeResponse(themes=[])

            result = await provider.suggest_groups(
                all_categories=["AI", "ML"],
                existing_groups={},
                config=MOCK_CONFIG,
            )

        assert mock_gen.call_count == 1  # Only Phase 1 called
        assert result.groups == []


class TestOllamaTwoPhase:
    @pytest.mark.asyncio
    async def test_suggest_groups_calls_two_phases(self):
        """suggest_groups should stream twice: ThemeResponse then GroupingResponse."""
        from backend.llm_providers.ollama import OllamaProvider

        provider = OllamaProvider()

        theme_json = '{"themes": ["Tech", "Science"]}'
        grouping_json = '{"groups": [{"parent": "Tech", "children": ["AI", "ML"]}]}'

        call_count = 0

        async def mock_chat(**kwargs):
            nonlocal call_count
            call_count += 1
            content = theme_json if call_count == 1 else grouping_json

            async def chunk_gen():
                yield {"message": {"content": content}}

            return chunk_gen()

        mock_client = AsyncMock()
        mock_client.chat = mock_chat

        with patch(
            "backend.llm_providers.ollama.get_ollama_client",
            return_value=mock_client,
        ):
            result = await provider.suggest_groups(
                all_categories=["AI", "ML", "Biology"],
                existing_groups={},
                config=ProviderTaskConfig(
                    endpoint="http://localhost:11434",
                    model="test-model",
                    thinking=False,
                ),
            )

        assert call_count == 2
        assert len(result.groups) == 1
        assert result.groups[0].parent == "Tech"
