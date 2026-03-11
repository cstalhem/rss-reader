"""Article CRUD endpoints."""

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, nulls_last, update
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from backend.deps import get_session
from backend.models import Article, Category, Feed
from backend.schemas import (
    ArticleCategoryEmbed,
    ArticleListItem,
    ArticleResponse,
    ArticleUpdate,
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
    from backend.scoring import get_effective_weight

    return [
        ArticleCategoryEmbed(
            id=cat.id,  # pyright: ignore[reportArgumentType]
            display_name=cat.display_name,
            slug=cat.slug,
            effective_weight=get_effective_weight(cat),
            parent_display_name=cat.parent.display_name if cat.parent else None,
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
        categories=_build_category_embeds(article),
        interest_score=article.interest_score,
        quality_score=article.quality_score,
        composite_score=article.composite_score,
        score_reasoning=article.score_reasoning,
        scoring_state=display_state,
        scored_at=article.scored_at,
        re_evaluating=re_eval,
    )


def _article_to_list_item(article: Article) -> ArticleListItem:
    """Convert an Article with loaded categories_rel to a lightweight list item."""
    display_state, re_eval = _derive_display_state(article)
    return ArticleListItem(
        id=article.id,  # pyright: ignore[reportArgumentType]
        feed_id=article.feed_id,
        title=article.title,
        url=article.url,
        author=article.author,
        published_at=article.published_at,
        is_read=article.is_read,
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


@router.get("", response_model=list[ArticleListItem])
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
    statement = select(Article).options(
        selectinload(Article.categories_rel).joinedload(Category.parent)  # pyright: ignore[reportArgumentType]
    )

    if is_read is not None:
        statement = statement.where(Article.is_read == is_read)

    if feed_id is not None:
        statement = statement.where(Article.feed_id == feed_id)

    if folder_id is not None:
        statement = statement.join(Feed, Feed.id == Article.feed_id).where(  # pyright: ignore[reportArgumentType]
            Feed.folder_id == folder_id
        )

    if scoring_state == "pending":
        statement = statement.where(
            Article.composite_score.is_(None),  # pyright: ignore[reportAttributeAccessIssue]  # first-time only — excludes re-evaluating
            (
                Article.scoring_state.in_(["unscored", "queued", "scoring"])  # pyright: ignore[reportAttributeAccessIssue]
                | Article.categorization_state.in_(["queued", "categorizing"])  # pyright: ignore[reportAttributeAccessIssue]
            ),
        )
    elif scoring_state == "blocked":
        statement = statement.where(Article.scoring_state == "scored").where(
            Article.composite_score == 0
        )
        exclude_blocked = False
    elif scoring_state == "failed":
        statement = statement.where(
            (Article.scoring_state == "failed")
            | (Article.categorization_state == "failed")
        )
        exclude_blocked = False
    elif scoring_state is not None:
        statement = statement.where(Article.scoring_state == scoring_state)

    if exclude_blocked and scoring_state is None:
        statement = statement.where(Article.scoring_state == "scored").where(
            Article.composite_score != 0
        )

    if scoring_state == "pending" and sort_by == "composite_score":
        sort_by = "published_at"
        order = "asc"

    if sort_by == "composite_score":
        if order == "desc":
            statement = statement.order_by(
                nulls_last(desc(Article.composite_score)),
                Article.published_at.asc(),  # pyright: ignore[reportArgumentType, reportAttributeAccessIssue, reportOptionalMemberAccess]
            )
        else:
            statement = statement.order_by(
                nulls_last(Article.composite_score),
                Article.published_at.asc(),  # pyright: ignore[reportArgumentType, reportAttributeAccessIssue, reportOptionalMemberAccess]
            )
    elif sort_by == "published_at":
        if order == "desc":
            statement = statement.order_by(Article.published_at.desc(), Article.id)  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess, reportArgumentType]
        else:
            statement = statement.order_by(Article.published_at.asc(), Article.id)  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess, reportArgumentType]

    statement = statement.offset(skip).limit(limit)
    articles = session.exec(statement).all()
    return [_article_to_list_item(article) for article in articles]


@router.post("/mark-all-read")
def mark_all_read(session: Session = Depends(get_session)):
    """Mark all unread scored non-blocked articles as read."""
    result = session.exec(
        update(Article)
        .where(Article.is_read.is_(False))  # pyright: ignore[reportAttributeAccessIssue]
        .where(Article.scoring_state == "scored")  # pyright: ignore[reportArgumentType]
        .where(Article.composite_score != 0)  # pyright: ignore[reportArgumentType]
        .values(is_read=True)
    )
    session.commit()
    return {"ok": True, "count": result.rowcount}


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

    article.is_read = update.is_read
    session.add(article)
    session.commit()
    session.refresh(article)

    return _article_to_response(article)
