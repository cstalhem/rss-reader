"""Article CRUD endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, nulls_last
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from backend.deps import get_session
from backend.models import Article, Category
from backend.schemas import ArticleCategoryEmbed, ArticleResponse, ArticleUpdate

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _article_to_response(article: Article) -> ArticleResponse:
    """Convert an Article with loaded categories_rel to an ArticleResponse."""
    from backend.scoring import get_effective_weight

    categories = None
    if article.categories_rel:
        categories = [
            ArticleCategoryEmbed(
                id=cat.id,
                display_name=cat.display_name,
                slug=cat.slug,
                effective_weight=get_effective_weight(cat),
                parent_display_name=cat.parent.display_name if cat.parent else None,
            )
            for cat in article.categories_rel
        ]

    return ArticleResponse(
        id=article.id,
        feed_id=article.feed_id,
        title=article.title,
        url=article.url,
        author=article.author,
        published_at=article.published_at,
        summary=article.summary,
        content=article.content,
        is_read=article.is_read,
        categories=categories,
        interest_score=article.interest_score,
        quality_score=article.quality_score,
        composite_score=article.composite_score,
        score_reasoning=article.score_reasoning,
        scoring_state=article.scoring_state,
        scored_at=article.scored_at,
    )


@router.get("", response_model=list[ArticleResponse])
def list_articles(
    skip: int = 0,
    limit: int = 50,
    is_read: bool | None = None,
    feed_id: int | None = None,
    sort_by: Literal["composite_score", "published_at"] = "composite_score",
    order: Literal["asc", "desc"] = "desc",
    scoring_state: str | None = None,
    exclude_blocked: bool = True,
    session: Session = Depends(get_session),
):
    """List articles, paginated and sorted by composite_score or published_at."""
    statement = select(Article).options(
        selectinload(Article.categories_rel).joinedload(Category.parent)
    )

    if is_read is not None:
        statement = statement.where(Article.is_read == is_read)

    if feed_id is not None:
        statement = statement.where(Article.feed_id == feed_id)

    if scoring_state == "pending":
        statement = statement.where(
            Article.scoring_state.in_(["unscored", "queued", "scoring"])
        )
    elif scoring_state == "blocked":
        statement = statement.where(Article.scoring_state == "scored").where(
            Article.composite_score == 0
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
                nulls_last(desc(Article.composite_score)), Article.published_at.asc()
            )
        else:
            statement = statement.order_by(
                nulls_last(Article.composite_score), Article.published_at.asc()
            )
    elif sort_by == "published_at":
        if order == "desc":
            statement = statement.order_by(Article.published_at.desc(), Article.id)
        else:
            statement = statement.order_by(Article.published_at.asc(), Article.id)

    statement = statement.offset(skip).limit(limit)
    articles = session.exec(statement).all()
    return [_article_to_response(article) for article in articles]


@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(
    article_id: int,
    session: Session = Depends(get_session),
):
    """Get a single article by ID with full content and rich categories."""
    article = session.exec(
        select(Article)
        .where(Article.id == article_id)
        .options(
            selectinload(Article.categories_rel).joinedload(Category.parent)
        )
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
        .options(
            selectinload(Article.categories_rel).joinedload(Category.parent)
        )
    ).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.is_read = update.is_read
    session.add(article)
    session.commit()
    session.refresh(article)

    return _article_to_response(article)
