"""Worker-seam tests for the closed-vocabulary categorization contract.

Issue #90 / ADR-0001 / ADR-0006. Real temp SQLite via the shared fixtures,
Azure wrapper faked. Covers the handoff, the blocked short-circuit, and the
proposal ladder (active match -> alias survivor -> alias discard -> create).

Enum-category names route through a vocabulary lookup: a miss is logged and
dropped, NEVER created. New categories enter ONLY through the single
`proposed_category` channel, resolved via `resolve_proposal`.
"""

import pytest
from sqlmodel import select

from backend.models import Article, ArticleCategoryLink, Category, CategoryAlias
from backend.prompts import ArticleCategoryResult, BatchCategoryResponse
from backend.scoring import resolve_proposal
from backend.scoring_queue import CategorizationWorker, ScoringWorker


def _links_for(session, article_id: int) -> list[Category]:
    rows = session.exec(
        select(Category)
        .join(ArticleCategoryLink, ArticleCategoryLink.category_id == Category.id)
        .where(ArticleCategoryLink.article_id == article_id)
    ).all()
    return list(rows)


# ---------------------------------------------------------------------------
# Case 4: handoff
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handoff_categorized_and_routed_to_scoring(
    test_session, sample_feed, fake_llm, make_article
):
    a1 = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    a2 = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=5)
    assert processed == 2

    test_session.expire_all()
    for art in (test_session.get(Article, a1.id), test_session.get(Article, a2.id)):
        assert art.categorization_state == "categorized"
        assert art.scoring_state == "queued"

    # The built-in default proposes "Technology"; both articles get a link.
    links = test_session.exec(select(ArticleCategoryLink)).all()
    assert {link.article_id for link in links} == {a1.id, a2.id}


# ---------------------------------------------------------------------------
# Case 5: blocked short-circuit never calls the scoring LLM
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_blocked_short_circuit_skips_scoring_llm(
    test_session, sample_feed, fake_llm, make_article, make_category, cat_result
):
    make_category(display_name="Crypto", slug="crypto", weight="block")
    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )

    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(results=[cat_result(article.id, ["Crypto"])]),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)
    # Run the scoring worker's poll: a blocked article must not be picked up.
    await ScoringWorker().process_next_batch(test_session, batch_size=5)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.scoring_state == "blocked"
    assert updated.composite_score == 0.0
    assert "Crypto" in (updated.score_reasoning or "")
    assert updated.scored_at is not None

    # The scoring task was never invoked on the wrapper.
    assert "scoring" not in fake_llm.tasks_invoked()


# ---------------------------------------------------------------------------
# Case 5b: a blocked category reached via the proposal channel also blocks
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_blocked_category_via_proposal_blocks_article(
    test_session, sample_feed, fake_llm, make_article, make_category, cat_result
):
    make_category(display_name="Crypto", slug="crypto", weight="block")
    make_category(display_name="AI", slug="ai", weight="normal")
    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )

    # No enum assignment — the blocked category arrives as a proposal.
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(results=[cat_result(article.id, [], proposed="Crypto")]),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)
    # Run the scoring worker's poll: a blocked article must not be picked up.
    await ScoringWorker().process_next_batch(test_session, batch_size=5)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.scoring_state == "blocked"
    assert updated.composite_score == 0.0
    assert "Crypto" in (updated.score_reasoning or "")

    # The scoring task was never invoked on the wrapper.
    assert "scoring" not in fake_llm.tasks_invoked()


# ---------------------------------------------------------------------------
# Case 6: proposal creates a triage-flagged normal-weight category
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_proposal_creates_triage_category(
    test_session, sample_feed, fake_llm, make_article, cat_result
):
    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(
            results=[cat_result(article.id, [], proposed="Retro Computing")]
        ),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    created = test_session.exec(
        select(Category).where(Category.slug == "retro-computing")
    ).first()
    assert created is not None
    assert created.weight == "normal"
    assert created.needs_triage is True
    assert created.parent_id is None

    linked = _links_for(test_session, article.id)
    assert [c.slug for c in linked] == ["retro-computing"]


# ---------------------------------------------------------------------------
# Case 7: alias -> survivor resolves to the target, no new row
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_alias_survivor_links_target_without_creating(
    test_session, sample_feed, fake_llm, make_article, make_category, cat_result
):
    ai = make_category(display_name="AI", slug="ai", weight="normal")
    test_session.add(CategoryAlias(alias_slug="crypto", target_id=ai.id))
    test_session.commit()

    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(results=[cat_result(article.id, [], proposed="Crypto")]),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    # No "crypto" category was created.
    assert (
        test_session.exec(select(Category).where(Category.slug == "crypto")).first()
        is None
    )
    linked = _links_for(test_session, article.id)
    assert [c.slug for c in linked] == ["ai"]


# ---------------------------------------------------------------------------
# Case 8: alias -> discard creates nothing; zero-category article still scores
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_alias_discard_creates_nothing_and_article_scores(
    test_session, sample_feed, fake_llm, make_article, cat_result
):
    test_session.add(CategoryAlias(alias_slug="crypto", target_id=None))
    test_session.commit()

    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    # No enum categories + a discarded proposal => zero assignments.
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(results=[cat_result(article.id, [], proposed="Crypto")]),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    # Discard created no category.
    assert (
        test_session.exec(select(Category).where(Category.slug == "crypto")).first()
        is None
    )
    assert _links_for(test_session, article.id) == []

    # The article proceeds to scoring despite having no categories.
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "categorized"
    assert updated.scoring_state == "queued"


# ---------------------------------------------------------------------------
# Case 9: proposal matching an active category by slug links, no duplicate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_proposal_matches_active_by_slug(
    test_session, sample_feed, fake_llm, make_article, make_category, cat_result
):
    make_category(
        display_name="Artificial Intelligence", slug="artificial-intelligence"
    )
    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(
            results=[cat_result(article.id, [], proposed="artificial-intelligence")]
        ),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    matches = test_session.exec(
        select(Category).where(Category.slug == "artificial-intelligence")
    ).all()
    assert len(matches) == 1  # no duplicate row

    linked = _links_for(test_session, article.id)
    assert [c.slug for c in linked] == ["artificial-intelligence"]


# ---------------------------------------------------------------------------
# Case 10: within-batch dedup of an identical proposal
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_within_batch_proposal_dedup(
    test_session, sample_feed, fake_llm, make_article, cat_result
):
    a1 = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    a2 = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(
            results=[
                cat_result(a1.id, [], proposed="Quantum Computing"),
                cat_result(a2.id, [], proposed="Quantum Computing"),
            ]
        ),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=5)

    test_session.expire_all()
    rows = test_session.exec(
        select(Category).where(Category.slug == "quantum-computing")
    ).all()
    assert len(rows) == 1  # exactly one row for both articles

    for aid in (a1.id, a2.id):
        assert [c.slug for c in _links_for(test_session, aid)] == ["quantum-computing"]


# ---------------------------------------------------------------------------
# Case 11: out-of-vocabulary enum name is dropped, never created
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_out_of_vocabulary_enum_name_is_dropped(
    test_session, sample_feed, fake_llm, make_article, make_category
):
    make_category(display_name="AI", slug="ai", weight="normal")
    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )

    # model_construct bypasses the enum so we can simulate a strict-mode leak.
    leaked = BatchCategoryResponse(
        results=[
            ArticleCategoryResult.model_construct(
                article_id=article.id,
                categories=["AI", "Nonexistent Topic"],
                proposed_category=None,
            )
        ]
    )
    fake_llm.queue("categorization", leaked)

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    # The unknown enum name created no category.
    assert (
        test_session.exec(
            select(Category).where(Category.slug == "nonexistent-topic")
        ).first()
        is None
    )
    # The article is categorized with only the valid name.
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "categorized"
    assert [c.slug for c in _links_for(test_session, article.id)] == ["ai"]


# ---------------------------------------------------------------------------
# resolve_proposal unit coverage (the ladder in isolation)
# ---------------------------------------------------------------------------


class TestResolveProposal:
    def test_active_match_returns_without_creating(self, test_session, make_category):
        make_category(display_name="AI", slug="ai")
        before = len(test_session.exec(select(Category)).all())

        resolved = resolve_proposal(test_session, "AI")

        assert resolved is not None
        assert resolved.slug == "ai"
        assert len(test_session.exec(select(Category)).all()) == before

    def test_alias_to_survivor_returns_target(self, test_session, make_category):
        ai = make_category(display_name="AI", slug="ai")
        test_session.add(CategoryAlias(alias_slug="crypto", target_id=ai.id))
        test_session.commit()

        resolved = resolve_proposal(test_session, "Crypto")

        assert resolved is not None
        assert resolved.slug == "ai"

    def test_alias_discard_returns_none(self, test_session):
        test_session.add(CategoryAlias(alias_slug="crypto", target_id=None))
        test_session.commit()

        assert resolve_proposal(test_session, "Crypto") is None

    def test_unknown_name_creates_triage_category(self, test_session):
        resolved = resolve_proposal(test_session, "Retro Computing")

        assert resolved is not None
        assert resolved.slug == "retro-computing"
        assert resolved.weight == "normal"
        assert resolved.needs_triage is True
        assert resolved.parent_id is None
