"""Tests for batch prompt builder functions."""

from backend.prompts.categorization import build_batch_categorization_prompt
from backend.prompts.scoring import build_batch_scoring_prompt

SAMPLE_ARTICLES = [
    {"id": 1, "title": "AI Advances", "content_markdown": "Content about AI."},
    {"id": 2, "title": "Climate Report", "content_markdown": "Content about climate."},
]

EXISTING_CATEGORIES = ["Technology", "Science", "AI"]


class TestBuildBatchCategorizationPrompt:
    def test_returns_tuple(self):
        result = build_batch_categorization_prompt(
            articles=SAMPLE_ARTICLES,
            existing_categories=EXISTING_CATEGORIES,
        )
        assert isinstance(result, tuple)
        assert len(result) == 2
        system_prompt, user_message = result
        assert isinstance(system_prompt, str)
        assert isinstance(user_message, str)

    def test_system_prompt_includes_batch_instructions(self):
        system_prompt, _ = build_batch_categorization_prompt(
            articles=SAMPLE_ARTICLES,
            existing_categories=EXISTING_CATEGORIES,
        )
        assert "results" in system_prompt.lower()
        assert "article_id" in system_prompt

    def test_system_prompt_includes_existing_categories(self):
        system_prompt, _ = build_batch_categorization_prompt(
            articles=SAMPLE_ARTICLES,
            existing_categories=EXISTING_CATEGORIES,
        )
        for cat in EXISTING_CATEGORIES:
            assert cat in system_prompt

    def test_user_message_contains_articles(self):
        _, user_message = build_batch_categorization_prompt(
            articles=SAMPLE_ARTICLES,
            existing_categories=EXISTING_CATEGORIES,
        )
        assert "<article id:1>" in user_message
        assert "<article id:2>" in user_message
        assert "AI Advances" in user_message
        assert "Climate Report" in user_message

    def test_hierarchy_included_when_provided(self):
        hierarchy = {"Technology": ["AI", "Programming"]}
        system_prompt, _ = build_batch_categorization_prompt(
            articles=SAMPLE_ARTICLES,
            existing_categories=EXISTING_CATEGORIES,
            category_hierarchy=hierarchy,
        )
        assert "Technology > AI, Programming" in system_prompt

    def test_hidden_categories_included_when_provided(self):
        system_prompt, _ = build_batch_categorization_prompt(
            articles=SAMPLE_ARTICLES,
            existing_categories=EXISTING_CATEGORIES,
            hidden_categories=["Politics", "Sports"],
        )
        assert "Politics" in system_prompt
        assert "Sports" in system_prompt


class TestBuildBatchScoringPrompt:
    def test_returns_tuple(self):
        result = build_batch_scoring_prompt(
            articles=SAMPLE_ARTICLES,
            interests="AI and machine learning",
            anti_interests="Celebrity gossip",
        )
        assert isinstance(result, tuple)
        assert len(result) == 2
        system_prompt, user_message = result
        assert isinstance(system_prompt, str)
        assert isinstance(user_message, str)

    def test_system_prompt_includes_interests(self):
        system_prompt, _ = build_batch_scoring_prompt(
            articles=SAMPLE_ARTICLES,
            interests="AI and machine learning",
            anti_interests="Celebrity gossip",
        )
        assert "AI and machine learning" in system_prompt
        assert "Celebrity gossip" in system_prompt

    def test_user_message_contains_articles(self):
        _, user_message = build_batch_scoring_prompt(
            articles=SAMPLE_ARTICLES,
            interests="AI",
            anti_interests="Sports",
        )
        assert "<article id:1>" in user_message
        assert "<article id:2>" in user_message
        assert "AI Advances" in user_message
        assert "Climate Report" in user_message

    def test_system_prompt_includes_batch_instructions(self):
        system_prompt, _ = build_batch_scoring_prompt(
            articles=SAMPLE_ARTICLES,
            interests="AI",
            anti_interests="",
        )
        assert "results" in system_prompt.lower()
        assert "article_id" in system_prompt
