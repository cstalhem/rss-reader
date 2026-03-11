"""Tests for CategorizationWorker and ScoringWorker batch processing."""

from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlmodel import select

import backend.scoring_queue as scoring_queue_module
from backend.llm_providers.base import ProviderTaskConfig
from backend.models import Article, ArticleCategoryLink, Category, Feed, UserPreferences
from backend.prompts import ArticleCategoryResult
from backend.prompts.scoring import ArticleScoringResult
from backend.scoring_queue import CategorizationWorker, ScoringWorker

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

    async def categorize(
        self,
        articles,
        existing_categories,
        config,
        category_hierarchy,
        hidden_categories,
    ):
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
    monkeypatch.setattr(
        scoring_queue_module, "evaluate_task_readiness", _fake_readiness
    )
    monkeypatch.setattr(scoring_queue_module, "get_provider", lambda _name: provider)
    # Ensure rate limiters are not active
    monkeypatch.setattr(
        scoring_queue_module, "is_categorization_rate_limited", lambda: False
    )
    monkeypatch.setattr(scoring_queue_module, "is_scoring_rate_limited", lambda: False)


def _make_queued_article(
    session,
    feed: Feed,
    idx: int,
    *,
    categorization_state: str = "queued",
    scoring_state: str = "unscored",
    **overrides,
) -> Article:
    defaults = {
        "feed_id": feed.id,
        "title": f"Batch article {idx}",
        "url": f"https://example.com/batch-{idx}",
        "published_at": datetime.now(),
        "content": f"Content for article {idx}",
        "categorization_state": categorization_state,
        "scoring_state": scoring_state,
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
# CategorizationWorker tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_categorization_batch_processed(test_session, sample_feed, monkeypatch):
    """3 queued articles → categorized, scoring_state = 'queued'."""
    _setup_preferences(test_session)
    articles = [_make_queued_article(test_session, sample_feed, i) for i in range(3)]

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=3)

    assert processed == 3
    assert len(provider.categorize_calls) == 1
    assert len(provider.categorize_calls[0]) == 3

    for art in articles:
        test_session.refresh(art)
        assert art.categorization_state == "categorized"
        assert art.scoring_state == "queued"


@pytest.mark.asyncio
async def test_categorization_blocked_articles(
    test_session, sample_feed, monkeypatch, make_category
):
    """Blocked category → scoring_state = 'scored', score = 0."""
    _setup_preferences(test_session)
    art = _make_queued_article(test_session, sample_feed, 0)

    make_category(display_name="Sports", slug="sports", weight="block")

    cat_results = [
        ArticleCategoryResult(article_id=art.id, categories=["Sports"]),
    ]
    provider = FakeProvider(cat_results=cat_results)
    _patch_queue(monkeypatch, provider)

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)

    assert processed == 1
    test_session.refresh(art)
    assert art.categorization_state == "categorized"
    assert art.scoring_state == "scored"
    assert art.interest_score == 0
    assert art.quality_score == 0
    assert art.composite_score == 0.0


@pytest.mark.asyncio
async def test_categorization_error_increments_attempts(
    test_session, sample_feed, monkeypatch
):
    """Error → categorization_attempts += 1, re-queued."""
    _setup_preferences(test_session)
    art = _make_queued_article(test_session, sample_feed, 0)
    assert art.categorization_attempts == 0

    provider = FakeProvider(cat_error=RuntimeError("LLM exploded"))
    _patch_queue(monkeypatch, provider)

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)

    assert processed == 0
    test_session.refresh(art)
    assert art.categorization_state == "queued"
    assert art.categorization_attempts == 1


@pytest.mark.asyncio
async def test_categorization_max_retries_sets_failed(
    test_session, sample_feed, monkeypatch
):
    """3 failures → categorization_state = 'failed'."""
    _setup_preferences(test_session)
    art = _make_queued_article(test_session, sample_feed, 0, categorization_attempts=2)

    provider = FakeProvider(cat_error=RuntimeError("LLM exploded"))
    _patch_queue(monkeypatch, provider)

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)

    assert processed == 0
    test_session.refresh(art)
    assert art.categorization_state == "failed"
    assert art.categorization_attempts == 3


@pytest.mark.asyncio
async def test_categorization_rate_limit_skips(test_session, sample_feed, monkeypatch):
    """Rate limited → returns 0, no processing."""
    _setup_preferences(test_session)
    _make_queued_article(test_session, sample_feed, 0)

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)
    # Override rate limiter to return True
    monkeypatch.setattr(
        scoring_queue_module, "is_categorization_rate_limited", lambda: True
    )

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)

    assert processed == 0
    assert len(provider.categorize_calls) == 0


@pytest.mark.asyncio
async def test_categorization_deletes_old_category_links(
    test_session, sample_feed, monkeypatch, make_category
):
    """Re-categorize deletes old links before inserting new."""
    _setup_preferences(test_session)
    old_cat = make_category(display_name="Old Category", slug="old-category")
    art = _make_queued_article(test_session, sample_feed, 0)

    # Create old link
    old_link = ArticleCategoryLink(article_id=art.id, category_id=old_cat.id)
    test_session.add(old_link)
    test_session.commit()

    # Provider returns a new category
    cat_results = [
        ArticleCategoryResult(article_id=art.id, categories=["technology"]),
    ]
    provider = FakeProvider(cat_results=cat_results)
    _patch_queue(monkeypatch, provider)

    worker = CategorizationWorker()
    await worker.process_next_batch(test_session, batch_size=1)

    # Old link should be gone
    links = test_session.exec(
        select(ArticleCategoryLink).where(ArticleCategoryLink.article_id == art.id)
    ).all()
    slugs = []
    for link in links:
        cat = test_session.get(Category, link.category_id)
        slugs.append(cat.slug)
    assert "old-category" not in slugs
    assert "technology" in slugs


@pytest.mark.asyncio
async def test_score_only_skips_categorization_worker(
    test_session, sample_feed, monkeypatch, make_category
):
    """Articles with rescore_mode='score_only' go straight to scoring queue."""
    _setup_preferences(test_session)
    cat = make_category(display_name="Technology", slug="technology")
    art = _make_queued_article(test_session, sample_feed, 0, rescore_mode="score_only")
    link = ArticleCategoryLink(article_id=art.id, category_id=cat.id)
    test_session.add(link)
    test_session.commit()

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)

    worker = CategorizationWorker()
    await worker.process_next_batch(test_session, batch_size=1)

    # Should route directly to scoring without calling categorize
    assert len(provider.categorize_calls) == 0
    test_session.refresh(art)
    assert art.scoring_state == "queued"
    assert art.scoring_attempts == 0
    # Categorization should be marked done
    assert art.categorization_state == "categorized"


# ---------------------------------------------------------------------------
# ScoringWorker tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scoring_batch_processed(
    test_session, sample_feed, monkeypatch, make_category
):
    """3 articles with scoring_state='queued' → scored."""
    _setup_preferences(test_session)
    cat = make_category(display_name="Technology", slug="technology")

    articles = []
    for i in range(3):
        art = _make_queued_article(
            test_session,
            sample_feed,
            i,
            categorization_state="categorized",
            scoring_state="queued",
        )
        link = ArticleCategoryLink(article_id=art.id, category_id=cat.id)
        test_session.add(link)
        articles.append(art)
    test_session.commit()

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=3)

    assert processed == 3
    assert len(provider.score_calls) == 1
    assert len(provider.score_calls[0]) == 3

    for art in articles:
        test_session.refresh(art)
        assert art.scoring_state == "scored"
        assert art.interest_score == 7
        assert art.quality_score == 8


@pytest.mark.asyncio
async def test_scoring_loads_categories_from_db(
    test_session, sample_feed, monkeypatch, make_category
):
    """Categories loaded from ArticleCategoryLink, not from categorization step."""
    _setup_preferences(test_session)
    cat = make_category(display_name="Technology", slug="technology", weight="boost")

    art = _make_queued_article(
        test_session,
        sample_feed,
        0,
        categorization_state="categorized",
        scoring_state="queued",
    )
    link = ArticleCategoryLink(article_id=art.id, category_id=cat.id)
    test_session.add(link)
    test_session.commit()

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)

    worker = ScoringWorker()
    await worker.process_next_batch(test_session, batch_size=1)

    test_session.refresh(art)
    assert art.scoring_state == "scored"
    # With boost (1.5x), interest=7, quality=8 → quality_mult=0.9 → 7*1.5*0.9=9.45
    assert art.composite_score is not None
    assert art.composite_score > 0


@pytest.mark.asyncio
async def test_scoring_error_increments_attempts(
    test_session, sample_feed, monkeypatch, make_category
):
    """Error → scoring_attempts += 1, re-queued."""
    _setup_preferences(test_session)
    cat = make_category(display_name="Technology", slug="technology")
    art = _make_queued_article(
        test_session,
        sample_feed,
        0,
        categorization_state="categorized",
        scoring_state="queued",
    )
    link = ArticleCategoryLink(article_id=art.id, category_id=cat.id)
    test_session.add(link)
    test_session.commit()
    assert art.scoring_attempts == 0

    provider = FakeProvider(score_error=RuntimeError("score failed"))
    _patch_queue(monkeypatch, provider)

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)

    assert processed == 0
    test_session.refresh(art)
    assert art.scoring_state == "queued"
    assert art.scoring_attempts == 1


@pytest.mark.asyncio
async def test_scoring_max_retries_sets_failed(
    test_session, sample_feed, monkeypatch, make_category
):
    """3 failures → scoring_state = 'failed'."""
    _setup_preferences(test_session)
    cat = make_category(display_name="Technology", slug="technology")
    art = _make_queued_article(
        test_session,
        sample_feed,
        0,
        categorization_state="categorized",
        scoring_state="queued",
        scoring_attempts=2,
    )
    link = ArticleCategoryLink(article_id=art.id, category_id=cat.id)
    test_session.add(link)
    test_session.commit()

    provider = FakeProvider(score_error=RuntimeError("score failed"))
    _patch_queue(monkeypatch, provider)

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)

    assert processed == 0
    test_session.refresh(art)
    assert art.scoring_state == "failed"
    assert art.scoring_attempts == 3


@pytest.mark.asyncio
async def test_scoring_rate_limit_skips(
    test_session, sample_feed, monkeypatch, make_category
):
    """Rate limited → returns 0."""
    _setup_preferences(test_session)
    cat = make_category(display_name="Technology", slug="technology")
    art = _make_queued_article(
        test_session,
        sample_feed,
        0,
        categorization_state="categorized",
        scoring_state="queued",
    )
    link = ArticleCategoryLink(article_id=art.id, category_id=cat.id)
    test_session.add(link)
    test_session.commit()

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)
    monkeypatch.setattr(scoring_queue_module, "is_scoring_rate_limited", lambda: True)

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)

    assert processed == 0
    assert len(provider.score_calls) == 0


# ---------------------------------------------------------------------------
# Enqueue tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_enqueue_articles_sets_categorization_queued(test_session, sample_feed):
    """enqueue_articles sets categorization_state='queued'."""
    art = Article(
        feed_id=sample_feed.id,
        title="Test",
        url="https://example.com/test",
        published_at=datetime.now(),
        content="Test content",
        categorization_state="uncategorized",
        scoring_state="unscored",
    )
    test_session.add(art)
    test_session.commit()
    test_session.refresh(art)

    worker = CategorizationWorker()
    count = worker.enqueue_articles(test_session, [art.id])

    assert count == 1
    test_session.refresh(art)
    assert art.categorization_state == "queued"
    assert art.categorization_attempts == 0


@pytest.mark.asyncio
async def test_enqueue_recent_score_only(test_session, sample_feed):
    """score_only=True sets scoring_state='queued', rescore_mode='score_only'."""
    art = Article(
        feed_id=sample_feed.id,
        title="Test",
        url="https://example.com/test",
        published_at=datetime.now(),
        content="Test content",
        categorization_state="categorized",
        scoring_state="scored",
        is_read=False,
    )
    test_session.add(art)
    test_session.commit()
    test_session.refresh(art)

    worker = CategorizationWorker()
    count = worker.enqueue_recent_for_rescoring(test_session, score_only=True)

    assert count >= 1
    test_session.refresh(art)
    assert art.scoring_state == "queued"
    assert art.rescore_mode == "score_only"
    assert art.scoring_attempts == 0


@pytest.mark.asyncio
async def test_enqueue_recent_full_rescore(test_session, sample_feed):
    """score_only=False sets categorization_state='queued'."""
    art = Article(
        feed_id=sample_feed.id,
        title="Test",
        url="https://example.com/test",
        published_at=datetime.now(),
        content="Test content",
        categorization_state="categorized",
        scoring_state="scored",
        is_read=False,
    )
    test_session.add(art)
    test_session.commit()
    test_session.refresh(art)

    worker = CategorizationWorker()
    count = worker.enqueue_recent_for_rescoring(test_session, score_only=False)

    assert count >= 1
    test_session.refresh(art)
    assert art.categorization_state == "queued"
    assert art.categorization_attempts == 0


@pytest.mark.asyncio
async def test_enqueue_single_for_rescoring(test_session, sample_feed):
    """Sets categorization_state='queued', scoring_priority=1."""
    art = Article(
        feed_id=sample_feed.id,
        title="Test",
        url="https://example.com/test",
        published_at=datetime.now(),
        content="Test content",
        categorization_state="categorized",
        scoring_state="scored",
    )
    test_session.add(art)
    test_session.commit()
    test_session.refresh(art)

    worker = CategorizationWorker()
    worker.enqueue_single_for_rescoring(test_session, art)

    test_session.refresh(art)
    assert art.categorization_state == "queued"
    assert art.categorization_attempts == 0
    assert art.scoring_priority == 1


# ---------------------------------------------------------------------------
# Integration test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_end_to_end_categorization_then_scoring(
    test_session, sample_feed, monkeypatch
):
    """Article flows through CategorizationWorker → ScoringWorker."""
    _setup_preferences(test_session)
    art = _make_queued_article(test_session, sample_feed, 0)

    provider = FakeProvider()
    _patch_queue(monkeypatch, provider)

    # Step 1: Categorize
    cat_worker = CategorizationWorker()
    cat_processed = await cat_worker.process_next_batch(test_session, batch_size=1)

    assert cat_processed == 1
    test_session.refresh(art)
    assert art.categorization_state == "categorized"
    assert art.scoring_state == "queued"

    # Verify categories were linked
    links = test_session.exec(
        select(ArticleCategoryLink).where(ArticleCategoryLink.article_id == art.id)
    ).all()
    assert len(links) > 0

    # Step 2: Score
    score_worker = ScoringWorker()
    score_processed = await score_worker.process_next_batch(test_session, batch_size=1)

    assert score_processed == 1
    test_session.refresh(art)
    assert art.scoring_state == "scored"
    assert art.interest_score == 7
    assert art.quality_score == 8
    assert art.composite_score is not None
    assert art.composite_score > 0
