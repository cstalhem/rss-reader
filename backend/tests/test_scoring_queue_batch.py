"""Tests for CategorizationWorker and ScoringWorker batch processing.

The Azure wrapper is the mock seam: workers are exercised against a
FakeLLMClient with canned typed responses, including malformed-batch
(hallucinated/missing ids) and rate-limit shapes.
"""

from datetime import datetime

import pytest
from sqlmodel import select

from backend.llm_client import LLMCallFailed, LLMNotConfigured, LLMUnavailable
from backend.models import Article, ArticleCategoryLink, Category, Feed
from backend.prompts import (
    ArticleCategoryResult,
    ArticleScoringResult,
    BatchCategoryResponse,
    BatchScoringResponse,
)
from backend.scoring_queue import MAX_TASK_RETRIES, CategorizationWorker, ScoringWorker


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


def _cat_result(article_id: int, categories: list[str], **kw) -> ArticleCategoryResult:
    return ArticleCategoryResult(
        article_id=article_id,
        categories=categories,
        suggested_new=kw.get("suggested_new", []),
        suggested_parent=kw.get("suggested_parent"),
    )


def _score_result(article_id: int, interest=7, quality=8) -> ArticleScoringResult:
    return ArticleScoringResult(
        article_id=article_id,
        interest_score=interest,
        quality_score=quality,
        reasoning="test",
    )


# ---------------------------------------------------------------------------
# CategorizationWorker
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_categorization_happy_path(test_session, sample_feed, fake_llm):
    a1 = _make_queued_article(test_session, sample_feed, 1)
    a2 = _make_queued_article(test_session, sample_feed, 2)

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=5)
    assert processed == 2

    test_session.expire_all()
    for art in (test_session.get(Article, a1.id), test_session.get(Article, a2.id)):
        assert art.categorization_state == "categorized"
        assert art.scoring_state == "queued"

    # New category created by the LLM is live but flagged for triage
    cat = test_session.exec(
        select(Category).where(Category.slug == "technology")
    ).first()
    assert cat is not None
    assert cat.needs_triage is True

    links = test_session.exec(select(ArticleCategoryLink)).all()
    assert {link.article_id for link in links} == {a1.id, a2.id}


@pytest.mark.asyncio
async def test_categorization_blocked_category_blocks_article(
    test_session, sample_feed, fake_llm, make_category
):
    make_category(display_name="Crypto", slug="crypto", weight="block")
    article = _make_queued_article(test_session, sample_feed, 1)

    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(results=[_cat_result(article.id, ["Crypto"])]),
    )

    worker = CategorizationWorker()
    await worker.process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "categorized"
    assert updated.scoring_state == "blocked"
    assert updated.composite_score == 0.0
    assert "Crypto" in (updated.score_reasoning or "")


@pytest.mark.asyncio
async def test_categorization_drops_hallucinated_and_requeues_missing(
    test_session, sample_feed, fake_llm
):
    article = _make_queued_article(test_session, sample_feed, 1)

    # Response references an id that was never sent; the sent id is missing
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(results=[_cat_result(999999, ["Technology"])]),
    )

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)
    assert processed == 0

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "queued"
    assert updated.categorization_attempts == 1
    # Hallucinated id must not create links
    assert test_session.exec(select(ArticleCategoryLink)).all() == []


@pytest.mark.asyncio
async def test_categorization_unavailable_requeues_without_attempt(
    test_session, sample_feed, fake_llm
):
    article = _make_queued_article(test_session, sample_feed, 1)
    fake_llm.queue("categorization", LLMUnavailable(30.0))

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)
    assert processed == 0

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "queued"
    assert updated.categorization_attempts == 0  # not the article's fault


@pytest.mark.asyncio
async def test_categorization_failure_counts_attempts_to_failed(
    test_session, sample_feed, fake_llm
):
    article = _make_queued_article(test_session, sample_feed, 1)
    worker = CategorizationWorker()

    for attempt in range(1, MAX_TASK_RETRIES + 1):
        fake_llm.queue("categorization", LLMCallFailed("bad request"))
        await worker.process_next_batch(test_session, batch_size=1)
        test_session.expire_all()
        updated = test_session.get(Article, article.id)
        assert updated.categorization_attempts == attempt

    assert updated.categorization_state == "failed"


@pytest.mark.asyncio
async def test_categorization_not_configured_leaves_queue_untouched(
    test_session, sample_feed, fake_llm
):
    article = _make_queued_article(test_session, sample_feed, 1)
    fake_llm.queue("categorization", LLMNotConfigured("no creds"))

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)
    assert processed == 0

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "queued"
    assert updated.categorization_attempts == 0


@pytest.mark.asyncio
async def test_categorization_unexpected_error_requeues_batch(
    test_session, sample_feed, fake_llm
):
    """An untyped exception must not strand the batch in 'categorizing'."""
    article = _make_queued_article(test_session, sample_feed, 1)
    fake_llm.queue("categorization", RuntimeError("wrapper bug"))

    worker = CategorizationWorker()
    with pytest.raises(RuntimeError):
        await worker.process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "queued"
    assert updated.categorization_attempts == 0


@pytest.mark.asyncio
async def test_scoring_unexpected_error_requeues_batch(
    test_session, sample_feed, fake_llm
):
    """An untyped exception must not strand the batch in 'scoring'."""
    article = _make_queued_article(
        test_session,
        sample_feed,
        1,
        categorization_state="categorized",
        scoring_state="queued",
    )
    fake_llm.queue("scoring", RuntimeError("wrapper bug"))

    worker = ScoringWorker()
    with pytest.raises(RuntimeError):
        await worker.process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.scoring_state == "queued"
    assert updated.scoring_attempts == 0


@pytest.mark.asyncio
async def test_score_only_articles_skip_categorization(
    test_session, sample_feed, fake_llm
):
    article = _make_queued_article(
        test_session,
        sample_feed,
        1,
        rescore_mode="score_only",
        scoring_state="scored",
        composite_score=5.0,
    )

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)
    assert processed == 1
    assert fake_llm.calls == []  # no LLM call for score_only routing

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "categorized"
    assert updated.scoring_state == "queued"


# ---------------------------------------------------------------------------
# ScoringWorker
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scoring_happy_path_applies_weights(
    test_session, sample_feed, fake_llm, make_category
):
    boost = make_category(display_name="AI", slug="ai", weight="boost")
    article = _make_queued_article(
        test_session,
        sample_feed,
        1,
        categorization_state="categorized",
        scoring_state="queued",
    )
    test_session.add(ArticleCategoryLink(article_id=article.id, category_id=boost.id))
    test_session.commit()

    fake_llm.queue(
        "scoring",
        BatchScoringResponse(
            results=[_score_result(article.id, interest=8, quality=10)]
        ),
    )

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)
    assert processed == 1

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.scoring_state == "scored"
    assert updated.interest_score == 8
    assert updated.quality_score == 10
    # 8 * 1.5 (boost) * 1.0 (quality 10)
    assert updated.composite_score == pytest.approx(12.0)
    assert updated.rescore_mode is None
    assert updated.scoring_priority == 0


@pytest.mark.asyncio
async def test_scoring_clamps_out_of_range_scores(test_session, sample_feed, fake_llm):
    article = _make_queued_article(
        test_session,
        sample_feed,
        1,
        categorization_state="categorized",
        scoring_state="queued",
    )
    fake_llm.queue(
        "scoring",
        BatchScoringResponse(
            results=[_score_result(article.id, interest=15, quality=-3)]
        ),
    )

    worker = ScoringWorker()
    await worker.process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.interest_score == 10
    assert updated.quality_score == 0


@pytest.mark.asyncio
async def test_scoring_drops_hallucinated_and_requeues_missing(
    test_session, sample_feed, fake_llm
):
    a1 = _make_queued_article(
        test_session,
        sample_feed,
        1,
        categorization_state="categorized",
        scoring_state="queued",
    )
    a2 = _make_queued_article(
        test_session,
        sample_feed,
        2,
        categorization_state="categorized",
        scoring_state="queued",
    )

    # a1 scored, a2 missing, plus one hallucinated id
    fake_llm.queue(
        "scoring",
        BatchScoringResponse(results=[_score_result(a1.id), _score_result(999999)]),
    )

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=5)
    assert processed == 1

    test_session.expire_all()
    scored = test_session.get(Article, a1.id)
    skipped = test_session.get(Article, a2.id)
    assert scored.scoring_state == "scored"
    assert skipped.scoring_state == "queued"
    assert skipped.scoring_attempts == 1
    hallucinated = test_session.get(Article, 999999)
    assert hallucinated is None


@pytest.mark.asyncio
async def test_scoring_unavailable_requeues_without_attempt(
    test_session, sample_feed, fake_llm
):
    article = _make_queued_article(
        test_session,
        sample_feed,
        1,
        categorization_state="categorized",
        scoring_state="queued",
    )
    fake_llm.queue("scoring", LLMUnavailable(45.0))

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=1)
    assert processed == 0

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.scoring_state == "queued"
    assert updated.scoring_attempts == 0


@pytest.mark.asyncio
async def test_scoring_failure_counts_attempts_to_failed(
    test_session, sample_feed, fake_llm
):
    article = _make_queued_article(
        test_session,
        sample_feed,
        1,
        categorization_state="categorized",
        scoring_state="queued",
    )
    worker = ScoringWorker()

    for attempt in range(1, MAX_TASK_RETRIES + 1):
        fake_llm.queue("scoring", LLMCallFailed("bad request"))
        await worker.process_next_batch(test_session, batch_size=1)
        test_session.expire_all()
        updated = test_session.get(Article, article.id)
        assert updated.scoring_attempts == attempt

    assert updated.scoring_state == "failed"


@pytest.mark.asyncio
async def test_priority_article_jumps_queue(test_session, sample_feed, fake_llm):
    """scoring_priority=1 articles are picked before older queued articles."""
    _make_queued_article(
        test_session,
        sample_feed,
        1,
        categorization_state="categorized",
        scoring_state="queued",
        published_at=datetime(2020, 1, 1),
    )
    priority = _make_queued_article(
        test_session,
        sample_feed,
        2,
        categorization_state="categorized",
        scoring_state="queued",
        scoring_priority=1,
        published_at=datetime(2026, 1, 1),
    )

    worker = ScoringWorker()
    await worker.process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    updated = test_session.get(Article, priority.id)
    assert updated.scoring_state == "scored"
