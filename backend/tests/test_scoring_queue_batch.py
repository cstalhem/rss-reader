"""Tests for true batch processing in ScoringQueue.process_next_batch()."""

from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlmodel import select

import backend.scoring_queue as scoring_queue_module
from backend.llm_providers.base import ProviderTaskConfig
from backend.models import Article, ArticleCategoryLink, Category, Feed, UserPreferences
from backend.prompts import ArticleCategoryResult
from backend.prompts.scoring import ArticleScoringResult
from backend.scoring_queue import ScoringQueue

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_runtime():
    return SimpleNamespace(
        ready=True,
        provider="fake",
        model="fake-model",
        endpoint="http://fake",
        thinking=False,
        api_key=None,
    )


async def _fake_readiness(*_a, **_kw):
    return _fake_runtime()


class FakeProvider:
    """Batch-aware fake provider for testing."""

    name = "fake"

    def __init__(
        self,
        *,
        cat_results: list[ArticleCategoryResult] | None = None,
        score_results: list[ArticleScoringResult] | None = None,
        cat_error: Exception | None = None,
        score_error: Exception | None = None,
    ):
        self._cat_results = cat_results
        self._score_results = score_results
        self._cat_error = cat_error
        self._score_error = score_error
        self.categorize_calls: list[list[dict]] = []
        self.score_calls: list[list[dict]] = []

    def parse_config(self, config_json, task):
        return ProviderTaskConfig(endpoint="fake", model="fake", thinking=False)

    async def categorize(self, articles, existing_categories, config, category_hierarchy, hidden_categories):
        self.categorize_calls.append(articles)
        if self._cat_error:
            raise self._cat_error
        if self._cat_results is not None:
            return self._cat_results
        # Default: return one result per article
        return [
            ArticleCategoryResult(article_id=a["id"], categories=["technology"])
            for a in articles
        ]

    async def score(self, articles, interests, anti_interests, config):
        self.score_calls.append(articles)
        if self._score_error:
            raise self._score_error
        if self._score_results is not None:
            return self._score_results
        return [
            ArticleScoringResult(
                article_id=a["id"], interest_score=7, quality_score=8, reasoning="test"
            )
            for a in articles
        ]


def _patch_queue(monkeypatch, provider: FakeProvider):
    """Monkeypatch scoring_queue module to use the given FakeProvider."""
    monkeypatch.setattr(scoring_queue_module, "evaluate_task_readiness", _fake_readiness)
    monkeypatch.setattr(scoring_queue_module, "get_provider", lambda _name: provider)


def _make_queued_article(session, feed: Feed, idx: int, **overrides) -> Article:
    defaults = {
        "feed_id": feed.id,
        "title": f"Batch article {idx}",
        "url": f"https://example.com/batch-{idx}",
        "published_at": datetime.now(),
        "content": f"Content for article {idx}",
        "scoring_state": "queued",
    }
    defaults.update(overrides)
    article = Article(**defaults)
    session.add(article)
    session.commit()
    session.refresh(article)
    return article


def _setup_preferences(session):
    prefs = UserPreferences(interests="technology", anti_interests="sports")
    session.add(prefs)
    session.commit()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_batch_of_3_processed_in_one_cycle(
    test_session, sample_feed, monkeypatch
):
    """3 queued articles → 1 categorize call + 1 score call → all scored."""
    _setup_preferences(test_session)
    articles = [_make_queued_article(test_session, sample_feed, i) for i in range(3)]

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)

    queue = ScoringQueue()
    processed = await queue.process_next_batch(test_session, batch_size=3)

    assert processed == 3
    # Exactly 1 categorize call and 1 score call (batch, not per-article)
    assert len(provider.categorize_calls) == 1
    assert len(provider.score_calls) == 1
    assert len(provider.categorize_calls[0]) == 3
    assert len(provider.score_calls[0]) == 3

    for art in articles:
        test_session.refresh(art)
        assert art.scoring_state == "scored"
        assert art.interest_score == 7
        assert art.quality_score == 8


@pytest.mark.asyncio
async def test_hallucinated_ids_ignored(
    test_session, sample_feed, monkeypatch
):
    """Provider returns an extra result with an ID not in the batch — ignored."""
    _setup_preferences(test_session)
    articles = [_make_queued_article(test_session, sample_feed, i) for i in range(2)]

    cat_results = [
        ArticleCategoryResult(article_id=articles[0].id, categories=["technology"]),
        ArticleCategoryResult(article_id=articles[1].id, categories=["science"]),
        ArticleCategoryResult(article_id=99999, categories=["hallucinated"]),
    ]
    score_results = [
        ArticleScoringResult(article_id=articles[0].id, interest_score=5, quality_score=6, reasoning="ok"),
        ArticleScoringResult(article_id=articles[1].id, interest_score=7, quality_score=8, reasoning="good"),
        ArticleScoringResult(article_id=99999, interest_score=1, quality_score=1, reasoning="ghost"),
    ]
    provider = FakeProvider(cat_results=cat_results, score_results=score_results)
    _patch_queue(monkeypatch, provider)

    queue = ScoringQueue()
    processed = await queue.process_next_batch(test_session, batch_size=2)

    assert processed == 2
    for art in articles:
        test_session.refresh(art)
        assert art.scoring_state == "scored"
    # No category "hallucinated" should exist
    hallucinated = test_session.exec(
        select(Category).where(Category.slug == "hallucinated")
    ).first()
    assert hallucinated is None


@pytest.mark.asyncio
async def test_partial_categorization_requeues_unmatched(
    test_session, sample_feed, monkeypatch
):
    """Provider returns results for 2 of 3 → 3rd re-queued."""
    _setup_preferences(test_session)
    articles = [_make_queued_article(test_session, sample_feed, i) for i in range(3)]

    # Only return categorization for first 2
    cat_results = [
        ArticleCategoryResult(article_id=articles[0].id, categories=["technology"]),
        ArticleCategoryResult(article_id=articles[1].id, categories=["science"]),
    ]
    provider = FakeProvider(cat_results=cat_results)
    _patch_queue(monkeypatch, provider)

    queue = ScoringQueue()
    processed = await queue.process_next_batch(test_session, batch_size=3)

    assert processed == 2
    test_session.refresh(articles[0])
    test_session.refresh(articles[1])
    test_session.refresh(articles[2])
    assert articles[0].scoring_state == "scored"
    assert articles[1].scoring_state == "scored"
    assert articles[2].scoring_state == "queued"


@pytest.mark.asyncio
async def test_score_only_skips_categorization(
    test_session, sample_feed, monkeypatch, make_category
):
    """Articles with rescore_mode='score_only' skip categorization call."""
    _setup_preferences(test_session)

    # Create a category and link it to the article
    cat = make_category(display_name="Technology", slug="technology")

    art = _make_queued_article(
        test_session, sample_feed, 0, rescore_mode="score_only"
    )
    link = ArticleCategoryLink(article_id=art.id, category_id=cat.id)
    test_session.add(link)
    test_session.commit()

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)

    queue = ScoringQueue()
    processed = await queue.process_next_batch(test_session, batch_size=1)

    assert processed == 1
    # Categorize should NOT have been called for this article
    if provider.categorize_calls:
        # If categorize was called, the score_only article should not be in it
        for call in provider.categorize_calls:
            assert all(a["id"] != art.id for a in call)
    # Score should have been called
    assert len(provider.score_calls) == 1
    test_session.refresh(art)
    assert art.scoring_state == "scored"


@pytest.mark.asyncio
async def test_blocked_articles_get_score_zero(
    test_session, sample_feed, monkeypatch, make_category
):
    """Articles categorized into blocked categories get score=0."""
    _setup_preferences(test_session)
    art = _make_queued_article(test_session, sample_feed, 0)

    # Create a blocked category (weight="block" persists through unhide logic)
    make_category(display_name="Sports", slug="sports", weight="block")

    # Provider will categorize into the blocked category
    cat_results = [
        ArticleCategoryResult(article_id=art.id, categories=["Sports"]),
    ]
    provider = FakeProvider(cat_results=cat_results)
    _patch_queue(monkeypatch, provider)

    queue = ScoringQueue()
    processed = await queue.process_next_batch(test_session, batch_size=1)

    assert processed == 1
    test_session.refresh(art)
    assert art.scoring_state == "scored"
    assert art.interest_score == 0
    assert art.quality_score == 0
    assert art.composite_score == 0.0
    # Blocked article should NOT appear in score calls
    assert len(provider.score_calls) == 0 or all(
        a["id"] != art.id for call in provider.score_calls for a in call
    )


@pytest.mark.asyncio
async def test_rate_limit_requeues_all(
    test_session, sample_feed, monkeypatch
):
    """Rate limit error → all articles re-queued."""
    _setup_preferences(test_session)
    articles = [_make_queued_article(test_session, sample_feed, i) for i in range(3)]

    provider = FakeProvider(cat_error=Exception("429 rate limit exceeded"))
    _patch_queue(monkeypatch, provider)

    queue = ScoringQueue()
    processed = await queue.process_next_batch(test_session, batch_size=3)

    assert processed == 0
    for art in articles:
        test_session.refresh(art)
        assert art.scoring_state == "queued"


@pytest.mark.asyncio
async def test_categorize_failure_requeues_all(
    test_session, sample_feed, monkeypatch
):
    """Non-rate-limit error on categorize → all articles re-queued."""
    _setup_preferences(test_session)
    articles = [_make_queued_article(test_session, sample_feed, i) for i in range(3)]

    provider = FakeProvider(cat_error=RuntimeError("LLM exploded"))
    _patch_queue(monkeypatch, provider)

    queue = ScoringQueue()
    processed = await queue.process_next_batch(test_session, batch_size=3)

    assert processed == 0
    for art in articles:
        test_session.refresh(art)
        assert art.scoring_state == "queued"


@pytest.mark.asyncio
async def test_score_failure_after_categorize_keeps_categories(
    test_session, sample_feed, monkeypatch
):
    """Score failure after successful categorize: categories kept, articles re-queued."""
    _setup_preferences(test_session)
    articles = [_make_queued_article(test_session, sample_feed, i) for i in range(2)]

    provider = FakeProvider(score_error=RuntimeError("score failed"))
    _patch_queue(monkeypatch, provider)

    queue = ScoringQueue()
    processed = await queue.process_next_batch(test_session, batch_size=2)

    assert processed == 0
    for art in articles:
        test_session.refresh(art)
        assert art.scoring_state == "queued"
        # Categories should still be linked
        links = test_session.exec(
            select(ArticleCategoryLink).where(
                ArticleCategoryLink.article_id == art.id
            )
        ).all()
        assert len(links) > 0, f"Article {art.id} should still have categories"
