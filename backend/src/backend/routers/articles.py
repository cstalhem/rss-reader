"""Article CRUD endpoints."""

import re
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import ColumnElement, desc, nulls_last, update
from sqlalchemy.orm import selectinload
from sqlmodel import Session, func, select

from backend.deps import (
    blocked_condition,
    get_session,
    read_condition,
    scoring_pending_condition,
    unread_condition,
    visible_condition,
)
from backend.models import Article, Category, Feed, FeedbackEvent
from backend.schemas import (
    ArticleCategoryEmbed,
    ArticleCountsResponse,
    ArticleListItem,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
    RatingUpdate,
)

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _strip_html_truncate(html: str | None, max_len: int = 200) -> str | None:
    """Strip HTML tags, normalize whitespace, and truncate with ellipsis."""
    if not html:
        return None
    text = re.sub(r"<[^>]+>", "", html)
    text = " ".join(text.split())
    if len(text) > max_len:
        return text[:max_len] + "..."
    return text


def _build_category_embeds(article: Article) -> list[ArticleCategoryEmbed] | None:
    """Build category embed list from an Article with loaded categories_rel."""
    if not article.categories_rel:
        return None

    return [
        ArticleCategoryEmbed(
            id=cat.id,  # pyright: ignore[reportArgumentType]
            display_name=cat.display_name,
            slug=cat.slug,
            effective_weight=cat.weight,
            parent_display_name=cat.parent.display_name if cat.parent else None,
            needs_triage=cat.needs_triage,
        )
        for cat in article.categories_rel
    ]


def _derive_display_state(article: Article) -> tuple[str, bool]:
    """Derive the API-facing scoring_state and re_evaluating flag.

    Returns (display_scoring_state, re_evaluating).
    """
    re_evaluating = article.composite_score is not None and (
        article.categorization_state in ("queued", "categorizing")
        or article.scoring_state in ("queued", "scoring")
    )

    if article.categorization_state == "failed":
        return "failed", re_evaluating
    if re_evaluating:
        return "scored", True
    if article.categorization_state in ("queued", "categorizing"):
        return article.categorization_state, False
    return article.scoring_state, re_evaluating


def _article_to_response(article: Article) -> ArticleResponse:
    """Convert an Article with loaded categories_rel to an ArticleResponse."""
    display_state, re_eval = _derive_display_state(article)
    return ArticleResponse(
        id=article.id,  # pyright: ignore[reportArgumentType]
        feed_id=article.feed_id,
        title=article.title,
        url=article.url,
        author=article.author,
        published_at=article.published_at,
        summary=article.summary,
        content=article.content,
        is_read=article.is_read,
        rating=article.rating,
        categories=_build_category_embeds(article),
        interest_score=article.interest_score,
        quality_score=article.quality_score,
        composite_score=article.composite_score,
        score_reasoning=article.score_reasoning,
        scoring_state=display_state,
        scored_at=article.scored_at,
        re_evaluating=re_eval,
    )


def _article_to_list_item(article: Article, feed_title: str) -> ArticleListItem:
    """Convert an Article with loaded categories_rel to a lightweight list item."""
    display_state, re_eval = _derive_display_state(article)
    return ArticleListItem(
        id=article.id,  # pyright: ignore[reportArgumentType]
        feed_id=article.feed_id,
        feed_title=feed_title,
        title=article.title,
        url=article.url,
        author=article.author,
        published_at=article.published_at,
        is_read=article.is_read,
        rating=article.rating,
        categories=_build_category_embeds(article),
        interest_score=article.interest_score,
        quality_score=article.quality_score,
        composite_score=article.composite_score,
        score_reasoning=article.score_reasoning,
        summary_preview=_strip_html_truncate(article.summary),
        scoring_state=display_state,
        scored_at=article.scored_at,
        re_evaluating=re_eval,
    )


def _scoping_conditions(
    feed_id: int | None, folder_id: int | None
) -> list[ColumnElement[bool]]:
    """Conditions scoping a query to a feed or folder — shared by list and counts.

    Callers must join Feed themselves when folder_id is used (the list endpoint
    already selects Article and joins Feed; the counts endpoint joins Feed too).
    """
    conditions: list[ColumnElement[bool]] = []
    if feed_id is not None:
        conditions.append(Article.feed_id == feed_id)  # pyright: ignore[reportArgumentType]
    if folder_id is not None:
        conditions.append(Feed.folder_id == folder_id)  # pyright: ignore[reportArgumentType]
    return conditions


def _scoring_state_condition(
    scoring_state: str | None, exclude_blocked: bool
) -> tuple[ColumnElement[bool] | None, bool]:
    """The condition for a scoring_state filter value, and the effective exclude_blocked.

    Returns (condition_or_None, exclude_blocked). A None condition means "no
    scoring_state-specific filter" (exclude_blocked then applies as usual).
    """
    if scoring_state == "pending":
        return scoring_pending_condition(), exclude_blocked
    if scoring_state == "blocked":
        return blocked_condition(), False
    if scoring_state == "failed":
        return (
            (Article.scoring_state == "failed")
            | (Article.categorization_state == "failed")
        ), False  # pyright: ignore[reportReturnType]
    if scoring_state is not None:
        return Article.scoring_state == scoring_state, False  # pyright: ignore[reportReturnType]
    return None, exclude_blocked


@router.get("", response_model=ArticleListResponse)
def list_articles(
    skip: int = 0,
    limit: int = 50,
    is_read: bool | None = None,
    feed_id: int | None = None,
    folder_id: int | None = None,
    sort_by: Literal["composite_score", "published_at"] = "composite_score",
    order: Literal["asc", "desc"] = "desc",
    scoring_state: str | None = None,
    exclude_blocked: bool = True,
    session: Session = Depends(get_session),
):
    """List articles, paginated and sorted by composite_score or published_at."""
    statement = (
        select(Article, Feed.title)
        .join(Feed, Feed.id == Article.feed_id)  # pyright: ignore[reportArgumentType]
        .options(
            selectinload(Article.categories_rel).joinedload(Category.parent)  # pyright: ignore[reportArgumentType]
        )
    )

    if is_read is not None:
        statement = statement.where(Article.is_read == is_read)

    for condition in _scoping_conditions(feed_id, folder_id):
        statement = statement.where(condition)

    state_condition, exclude_blocked = _scoring_state_condition(
        scoring_state, exclude_blocked
    )
    if state_condition is not None:
        statement = statement.where(state_condition)

    if exclude_blocked and scoring_state is None:
        statement = statement.where(visible_condition())

    if scoring_state == "pending" and sort_by == "composite_score":
        sort_by = "published_at"
        order = "asc"

    if sort_by == "composite_score":
        if order == "desc":
            statement = statement.order_by(
                nulls_last(desc(Article.composite_score)),  # pyright: ignore[reportArgumentType]
                Article.published_at.asc(),  # pyright: ignore[reportArgumentType, reportAttributeAccessIssue, reportOptionalMemberAccess]
            )
        else:
            statement = statement.order_by(
                nulls_last(Article.composite_score),  # pyright: ignore[reportArgumentType]
                Article.published_at.asc(),  # pyright: ignore[reportArgumentType, reportAttributeAccessIssue, reportOptionalMemberAccess]
            )
    elif sort_by == "published_at":
        if order == "desc":
            statement = statement.order_by(Article.published_at.desc(), Article.id)  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess, reportArgumentType]
        else:
            statement = statement.order_by(Article.published_at.asc(), Article.id)  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess, reportArgumentType]

    # Fetch one extra row to determine has_more without a second count query.
    statement = statement.offset(skip).limit(limit + 1)
    rows = session.exec(statement).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    return ArticleListResponse(
        items=[
            _article_to_list_item(article, feed_title) for article, feed_title in rows
        ],
        has_more=has_more,
    )


@router.get("/counts", response_model=ArticleCountsResponse)
def get_article_counts(
    feed_id: int | None = None,
    folder_id: int | None = None,
    session: Session = Depends(get_session),
):
    """Counts for the four article list views, scoped identically to the list endpoint.

    Each count is computed from the same condition helpers the list endpoint's
    filters use, so a count always equals what the matching list query returns.
    """
    # One scan with conditional aggregates — this endpoint is polled every 10s.
    statement = select(
        func.count(Article.id).filter(unread_condition()),  # pyright: ignore[reportArgumentType]
        func.count(Article.id).filter(read_condition()),  # pyright: ignore[reportArgumentType]
        func.count(Article.id).filter(scoring_pending_condition()),  # pyright: ignore[reportArgumentType]
        func.count(Article.id).filter(blocked_condition()),  # pyright: ignore[reportArgumentType]
    ).join(
        Feed,
        Feed.id == Article.feed_id,  # pyright: ignore[reportArgumentType]
    )
    for scope in _scoping_conditions(feed_id, folder_id):
        statement = statement.where(scope)
    unread, read, scoring, blocked = session.exec(statement).one()

    return ArticleCountsResponse(
        unread=unread,
        read=read,
        scoring=scoring,
        blocked=blocked,
    )


@router.post("/mark-all-read")
def mark_all_read(session: Session = Depends(get_session)):
    """Mark all unread articles read — same definition of unread as counts/badges."""
    result = session.exec(
        update(Article).where(unread_condition()).values(is_read=True)  # pyright: ignore[reportArgumentType]
    )
    session.commit()
    return {"ok": True, "count": result.rowcount}


@router.post("/{article_id}/rescue")
def rescue_article(article_id: int, session: Session = Depends(get_session)):
    """Rescue a blocked article: the user verdict outranks the classifier.

    Moves the article out of 'blocked' immediately and re-queues it for a
    score-only pass. The pipeline never re-blocks a rescued article.

    Idempotent: replaying a rescue on an already-rescued article is a no-op
    while queued/scoring/scored, and doubles as a retry if the re-score
    previously exhausted its attempts and failed.
    """
    from backend.scheduler import categorization_worker

    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if article.scoring_state == "blocked":
        article.rescued_at = datetime.now()
        article.interest_score = None
        article.quality_score = None
        article.composite_score = None
        session.add(
            FeedbackEvent(article_id=article_id, event_type="rescued", value=None)
        )
        categorization_worker.enqueue_single_for_rescoring(
            session, article, score_only=True
        )
        return {"ok": True}

    if article.rescued_at is not None and article.scoring_state == "failed":
        article.interest_score = None
        article.quality_score = None
        article.composite_score = None
        categorization_worker.enqueue_single_for_rescoring(
            session, article, score_only=True
        )
        return {"ok": True}

    if article.rescued_at is not None:
        return {"ok": True}

    raise HTTPException(status_code=409, detail="Article is not blocked")


@router.post("/{article_id}/rescore")
def rescore_article(article_id: int, session: Session = Depends(get_session)):
    """Queue a single article for re-scoring with high priority."""
    article = session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    from backend.scheduler import categorization_worker

    categorization_worker.enqueue_single_for_rescoring(session, article)
    return {"ok": True}


@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(
    article_id: int,
    session: Session = Depends(get_session),
):
    """Get a single article by ID with full content and rich categories."""
    article = session.exec(
        select(Article)
        .where(Article.id == article_id)
        .options(selectinload(Article.categories_rel).joinedload(Category.parent))  # pyright: ignore[reportArgumentType]
    ).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return _article_to_response(article)


@router.patch("/{article_id}", response_model=ArticleResponse)
def update_article(
    article_id: int,
    update: ArticleUpdate,
    session: Session = Depends(get_session),
):
    """Update article read status."""
    article = session.exec(
        select(Article)
        .where(Article.id == article_id)
        .options(selectinload(Article.categories_rel).joinedload(Category.parent))  # pyright: ignore[reportArgumentType]
    ).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Log a marked_read fact only on a genuine false->true transition.
    if not article.is_read and update.is_read:
        session.add(
            FeedbackEvent(article_id=article_id, event_type="marked_read", value=None)
        )

    article.is_read = update.is_read
    session.add(article)
    session.commit()
    session.refresh(article)

    return _article_to_response(article)


@router.put("/{article_id}/rating", response_model=ArticleResponse)
def update_rating(
    article_id: int,
    update: RatingUpdate,
    session: Session = Depends(get_session),
):
    """Set the thumbs rating (+1/-1/null), appending a rated fact on change.

    The rating is a mutable projection; every genuine change also appends an
    append-only FeedbackEvent (a clear logs value=NULL, distinct from "never
    rated"). A no-op same-value write appends nothing.
    """
    article = session.exec(
        select(Article)
        .where(Article.id == article_id)
        .options(selectinload(Article.categories_rel).joinedload(Category.parent))  # pyright: ignore[reportArgumentType]
    ).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if update.value != article.rating:
        article.rating = update.value
        session.add(article)
        session.add(
            FeedbackEvent(article_id=article_id, event_type="rated", value=update.value)
        )
        session.commit()
        session.refresh(article)

    return _article_to_response(article)
