import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slugify import slugify
from sqlalchemy import desc, nulls_last
from sqlalchemy.orm import selectinload
from sqlmodel import Session, func, select

from backend import ollama_service
from backend.config import get_settings
from backend.database import create_db_and_tables, get_session, smart_case
from backend.feeds import fetch_feed, refresh_feed, save_articles
from backend.models import Article, ArticleCategoryLink, Category, Feed, UserPreferences
from backend.scheduler import shutdown_scheduler, start_scheduler

settings = get_settings()

# Configure logging from settings
logging.basicConfig(
    level=getattr(logging, settings.logging.level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and scheduler on startup."""
    logger.info("Starting up...")

    # Ensure data directory exists (extract from database path)
    data_dir = os.path.dirname(settings.database.path)
    if data_dir:  # Only create if path has a directory component
        os.makedirs(data_dir, exist_ok=True)

    # Create tables
    create_db_and_tables()

    # Start the scheduler
    start_scheduler()

    yield

    # Shutdown the scheduler
    shutdown_scheduler()
    logger.info("Shutting down...")


app = FastAPI(
    title="RSS Reader API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3210", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class HealthResponse(BaseModel):
    status: str


class ArticleUpdate(BaseModel):
    is_read: bool


class RefreshResponse(BaseModel):
    message: str
    new_articles: int


class FeedCreate(BaseModel):
    url: str


class FeedUpdate(BaseModel):
    title: str | None = None
    display_order: int | None = None


class FeedReorder(BaseModel):
    feed_ids: list[int]


class FeedResponse(BaseModel):
    id: int
    url: str
    title: str
    display_order: int
    last_fetched_at: datetime | None
    unread_count: int


class PreferencesResponse(BaseModel):
    interests: str
    anti_interests: str
    updated_at: datetime


class PreferencesUpdate(BaseModel):
    interests: str | None = None
    anti_interests: str | None = None


# --- Category Pydantic models ---


class CategoryResponse(BaseModel):
    """Category object returned by API."""
    id: int
    display_name: str
    slug: str
    weight: str | None
    parent_id: int | None
    is_hidden: bool
    is_seen: bool
    is_manually_created: bool
    article_count: int


class CategoryCreateRequest(BaseModel):
    display_name: str
    parent_id: int | None = None


class CategoryUpdate(BaseModel):
    display_name: str | None = None
    parent_id: int | None = None
    weight: str | None = None
    is_hidden: bool | None = None
    is_seen: bool | None = None


class CategoryMerge(BaseModel):
    source_id: int
    target_id: int


class CategoryAcknowledgeRequest(BaseModel):
    category_ids: list[int]


# --- Article category embedding ---


class ArticleCategoryEmbed(BaseModel):
    """Category embedded in article response."""
    id: int
    display_name: str
    slug: str
    effective_weight: str
    parent_display_name: str | None


class ArticleResponse(BaseModel):
    id: int
    feed_id: int
    title: str
    url: str
    author: str | None
    published_at: datetime | None
    summary: str | None
    content: str | None
    is_read: bool
    categories: list[ArticleCategoryEmbed] | None
    interest_score: int | None
    quality_score: int | None
    composite_score: float | None
    score_reasoning: str | None
    scoring_state: str
    scored_at: datetime | None


# Ollama API models
class OllamaHealthResponse(BaseModel):
    connected: bool
    version: str | None
    latency_ms: int | None


class OllamaModelResponse(BaseModel):
    name: str
    size: int
    parameter_size: str | None
    quantization_level: str | None
    is_loaded: bool


class PullModelRequest(BaseModel):
    model: str


class OllamaConfigResponse(BaseModel):
    categorization_model: str
    scoring_model: str
    use_separate_models: bool


class OllamaConfigUpdate(BaseModel):
    categorization_model: str
    scoring_model: str
    use_separate_models: bool
    rescore: bool = False


class OllamaPromptsResponse(BaseModel):
    categorization_prompt: str
    scoring_prompt: str


# API Endpoints


@app.get("/health", response_model=HealthResponse, status_code=200, tags=["monitoring"])
def health_check():
    """Health check endpoint for monitoring and container orchestration."""
    return HealthResponse(status="healthy")


@app.get("/api/articles")
def list_articles(
    skip: int = 0,
    limit: int = 50,
    is_read: bool | None = None,
    feed_id: int | None = None,
    sort_by: str = "composite_score",
    order: str = "desc",
    scoring_state: str | None = None,
    exclude_blocked: bool = True,
    session: Session = Depends(get_session),
):
    """
    List articles, paginated and sorted by composite_score or published_at.

    Query params:
        skip: Number of articles to skip (default: 0)
        limit: Maximum number of articles to return (default: 50)
        is_read: Filter by read status (optional). If not provided, returns all articles.
        feed_id: Filter by feed ID (optional). If not provided, returns articles from all feeds.
        sort_by: Sort field - "composite_score" or "published_at" (default: composite_score)
        order: Sort order - "desc" or "asc" (default: desc)
        scoring_state: Filter by scoring state (optional). Special values:
            - "pending": filters to unscored, queued, or scoring
            - "blocked": filters to scored articles with composite_score == 0
        exclude_blocked: When True (default), only show scored non-blocked articles in main views.
            Unscored/queued/scoring articles are hidden until scoring completes.
    """
    statement = select(Article).options(
        selectinload(Article.categories_rel).joinedload(Category.parent)
    )

    # Apply filters
    if is_read is not None:
        statement = statement.where(Article.is_read == is_read)

    if feed_id is not None:
        statement = statement.where(Article.feed_id == feed_id)

    # Apply scoring_state filter
    if scoring_state == "pending":
        statement = statement.where(
            Article.scoring_state.in_(["unscored", "queued", "scoring"])
        )
    elif scoring_state == "blocked":
        statement = statement.where(Article.scoring_state == "scored").where(
            Article.composite_score == 0
        )
        exclude_blocked = (
            False  # Override: when explicitly viewing blocked tab, show them
        )
    elif scoring_state is not None:
        statement = statement.where(Article.scoring_state == scoring_state)

    # In main views (Unread/All), only show scored non-blocked articles.
    # Articles still being scored belong in the Scoring tab, not the main feed.
    if exclude_blocked and scoring_state is None:
        statement = statement.where(Article.scoring_state == "scored").where(
            Article.composite_score != 0
        )

    # Apply sorting
    # For pending tab, default to oldest-first if sort_by is still default
    if scoring_state == "pending" and sort_by == "composite_score":
        sort_by = "published_at"
        order = "asc"

    if sort_by == "composite_score":
        # Primary: composite_score with NULLs last, secondary: published_at ASC (oldest first)
        if order == "desc":
            statement = statement.order_by(
                nulls_last(desc(Article.composite_score)), Article.published_at.asc()
            )
        else:
            statement = statement.order_by(
                nulls_last(Article.composite_score), Article.published_at.asc()
            )
    elif sort_by == "published_at":
        # Primary: published_at, secondary: id for stability
        if order == "desc":
            statement = statement.order_by(Article.published_at.desc(), Article.id)
        else:
            statement = statement.order_by(Article.published_at.asc(), Article.id)

    statement = statement.offset(skip).limit(limit)
    articles = session.exec(statement).all()
    return [_article_to_response(article) for article in articles]


@app.get("/api/articles/{article_id}", response_model=ArticleResponse)
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


@app.patch("/api/articles/{article_id}", response_model=ArticleResponse)
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


@app.get("/api/feeds", response_model=list[FeedResponse])
def list_feeds(
    session: Session = Depends(get_session),
):
    """List all feeds with unread count, ordered by display_order."""
    feeds = session.exec(select(Feed).order_by(Feed.display_order, Feed.id)).all()

    # Build response with unread counts
    feed_responses = []
    for feed in feeds:
        unread_count = session.exec(
            select(func.count(Article.id))
            .where(Article.feed_id == feed.id)
            .where(Article.is_read.is_(False))
        ).one()

        feed_responses.append(
            FeedResponse(
                id=feed.id,
                url=feed.url,
                title=feed.title,
                display_order=feed.display_order,
                last_fetched_at=feed.last_fetched_at,
                unread_count=unread_count,
            )
        )

    return feed_responses


@app.post("/api/feeds", response_model=FeedResponse, status_code=201)
async def create_feed(
    feed_create: FeedCreate,
    session: Session = Depends(get_session),
):
    """Create a new feed by URL, validate it, and fetch initial articles."""
    url = feed_create.url.strip()

    # Validate URL format
    if not url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="Invalid URL format. Must start with http:// or https://",
        )

    # Check for duplicate URL
    existing_feed = session.exec(select(Feed).where(Feed.url == url)).first()

    if existing_feed:
        raise HTTPException(
            status_code=400,
            detail="Feed with this URL already exists",
        )

    # Fetch and validate the feed
    try:
        parsed_feed = await fetch_feed(url)

        # Check if feed is valid and has entries
        if parsed_feed.bozo and not parsed_feed.entries:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid RSS feed or feed has no entries: {parsed_feed.get('bozo_exception', 'Unknown error')}",
            )

    except Exception as e:
        logger.error(f"Failed to fetch feed {url}: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch feed: {str(e)}",
        ) from e

    # Get max display_order for new feed
    max_order_result = session.exec(select(func.max(Feed.display_order))).one()
    next_order = (max_order_result or 0) + 1

    # Create feed
    feed_title = parsed_feed.feed.get("title", "Untitled Feed")
    feed = Feed(
        url=url,
        title=feed_title,
        display_order=next_order,
        last_fetched_at=datetime.now(),
    )
    session.add(feed)
    session.commit()
    session.refresh(feed)

    # Save initial articles and enqueue for scoring
    article_count, new_article_ids = save_articles(
        session, feed.id, parsed_feed.entries
    )
    logger.info(f"Created feed {feed.title} with {article_count} articles")

    # Enqueue new articles for scoring
    if new_article_ids:
        from backend.scheduler import scoring_queue

        await scoring_queue.enqueue_articles(session, new_article_ids)

    # Return feed with unread count
    return FeedResponse(
        id=feed.id,
        url=feed.url,
        title=feed.title,
        display_order=feed.display_order,
        last_fetched_at=feed.last_fetched_at,
        unread_count=article_count,
    )


@app.patch("/api/feeds/reorder")
def reorder_feeds(
    feed_reorder: FeedReorder,
    session: Session = Depends(get_session),
):
    """Reorder feeds by updating display_order based on provided feed_ids order."""
    for index, feed_id in enumerate(feed_reorder.feed_ids):
        feed = session.get(Feed, feed_id)
        if feed:
            feed.display_order = index
            session.add(feed)

    session.commit()
    return {"ok": True}


@app.delete("/api/feeds/{feed_id}")
def delete_feed(
    feed_id: int,
    session: Session = Depends(get_session),
):
    """Delete a feed and all its articles (CASCADE)."""
    feed = session.get(Feed, feed_id)

    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    session.delete(feed)
    session.commit()

    return {"ok": True}


@app.patch("/api/feeds/{feed_id}", response_model=FeedResponse)
def update_feed(
    feed_id: int,
    feed_update: FeedUpdate,
    session: Session = Depends(get_session),
):
    """Update feed title and/or display_order."""
    feed = session.get(Feed, feed_id)

    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    # Update only non-None fields
    if feed_update.title is not None:
        feed.title = feed_update.title

    if feed_update.display_order is not None:
        feed.display_order = feed_update.display_order

    session.add(feed)
    session.commit()
    session.refresh(feed)

    # Calculate unread count for response
    unread_count = session.exec(
        select(func.count(Article.id))
        .where(Article.feed_id == feed.id)
        .where(Article.is_read.is_(False))
    ).one()

    return FeedResponse(
        id=feed.id,
        url=feed.url,
        title=feed.title,
        display_order=feed.display_order,
        last_fetched_at=feed.last_fetched_at,
        unread_count=unread_count,
    )


@app.post("/api/feeds/{feed_id}/mark-all-read")
def mark_feed_read(
    feed_id: int,
    session: Session = Depends(get_session),
):
    """Mark all articles in a feed as read."""
    feed = session.get(Feed, feed_id)

    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    # Update all unread articles for this feed
    articles = session.exec(
        select(Article)
        .where(Article.feed_id == feed_id)
        .where(Article.is_read.is_(False))
    ).all()

    count = len(articles)
    for article in articles:
        article.is_read = True
        session.add(article)

    session.commit()

    return {"ok": True, "count": count}


@app.post("/api/feeds/refresh", response_model=RefreshResponse)
async def manual_refresh(
    session: Session = Depends(get_session),
):
    """Manually trigger feed refresh for all feeds."""
    feeds = session.exec(select(Feed)).all()

    if not feeds:
        return RefreshResponse(
            message="No feeds configured",
            new_articles=0,
        )

    total_new = 0
    for feed in feeds:
        try:
            new_count = await refresh_feed(session, feed)
            total_new += new_count
        except Exception as e:
            logger.error(f"Failed to refresh feed {feed.url}: {e}")
            # Continue with other feeds

    return RefreshResponse(
        message=f"Refreshed {len(feeds)} feed(s)",
        new_articles=total_new,
    )


@app.get("/api/preferences", response_model=PreferencesResponse)
def get_preferences(
    session: Session = Depends(get_session),
):
    """Get user preferences. Creates default preferences if none exist."""
    preferences = _get_or_create_preferences(session)

    return PreferencesResponse(
        interests=preferences.interests,
        anti_interests=preferences.anti_interests,
        updated_at=preferences.updated_at,
    )


@app.put("/api/preferences", response_model=PreferencesResponse)
async def update_preferences(
    update: PreferencesUpdate,
    session: Session = Depends(get_session),
):
    """Update user preferences. Merges non-None fields and triggers re-scoring."""
    preferences = _get_or_create_preferences(session)

    # Update non-None fields
    if update.interests is not None:
        preferences.interests = update.interests

    if update.anti_interests is not None:
        preferences.anti_interests = update.anti_interests

    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    # Trigger re-scoring of recent articles
    from backend.scheduler import scoring_queue

    await scoring_queue.enqueue_recent_for_rescoring(session)

    return PreferencesResponse(
        interests=preferences.interests,
        anti_interests=preferences.anti_interests,
        updated_at=preferences.updated_at,
    )


# --- Helpers ---


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


def _get_or_create_preferences(session: Session) -> UserPreferences:
    """Get existing preferences or create defaults."""
    preferences = session.exec(select(UserPreferences)).first()
    if not preferences:
        preferences = UserPreferences(
            interests="",
            anti_interests="",
            updated_at=datetime.now(),
        )
        session.add(preferences)
        session.commit()
        session.refresh(preferences)
    return preferences


def _category_article_count(session: Session, category_id: int) -> int:
    """Get article count for a category via junction table."""
    return session.exec(
        select(func.count(ArticleCategoryLink.article_id))
        .where(ArticleCategoryLink.category_id == category_id)
    ).one()


def _category_to_response(session: Session, category: Category) -> CategoryResponse:
    """Convert a Category model to a CategoryResponse with article_count."""
    return CategoryResponse(
        id=category.id,
        display_name=category.display_name,
        slug=category.slug,
        weight=category.weight,
        parent_id=category.parent_id,
        is_hidden=category.is_hidden,
        is_seen=category.is_seen,
        is_manually_created=category.is_manually_created,
        article_count=_category_article_count(session, category.id),
    )


# --- Category CRUD Endpoints ---


VALID_WEIGHTS = {"block", "reduce", "normal", "boost", "max"}


@app.get("/api/categories", response_model=list[CategoryResponse])
def list_categories(
    session: Session = Depends(get_session),
):
    """Get flat list of all categories with article counts."""
    # Query categories with article counts via LEFT JOIN
    statement = (
        select(Category, func.count(ArticleCategoryLink.article_id).label("article_count"))
        .outerjoin(ArticleCategoryLink, Category.id == ArticleCategoryLink.category_id)
        .group_by(Category.id)
        .order_by(Category.display_name)
    )
    results = session.exec(statement).all()

    return [
        CategoryResponse(
            id=cat.id,
            display_name=cat.display_name,
            slug=cat.slug,
            weight=cat.weight,
            parent_id=cat.parent_id,
            is_hidden=cat.is_hidden,
            is_seen=cat.is_seen,
            is_manually_created=cat.is_manually_created,
            article_count=count,
        )
        for cat, count in results
    ]


@app.post("/api/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    body: CategoryCreateRequest,
    session: Session = Depends(get_session),
):
    """Create a new category with display_name and optional parent_id."""
    slug = slugify(body.display_name)
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid category name")

    # Check for duplicate slug
    existing = session.exec(select(Category).where(Category.slug == slug)).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Category '{body.display_name}' already exists",
        )

    # Validate parent if provided
    if body.parent_id is not None:
        parent = session.get(Category, body.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    category = Category(
        display_name=smart_case(body.display_name),
        slug=slug,
        parent_id=body.parent_id,
        is_manually_created=True,
        is_seen=True,
    )
    session.add(category)
    session.commit()
    session.refresh(category)

    return CategoryResponse(
        id=category.id,
        display_name=category.display_name,
        slug=category.slug,
        weight=category.weight,
        parent_id=category.parent_id,
        is_hidden=category.is_hidden,
        is_seen=category.is_seen,
        is_manually_created=category.is_manually_created,
        article_count=0,
    )


@app.patch("/api/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    session: Session = Depends(get_session),
):
    """Update a category (rename, reparent, weight change, etc.)."""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if body.display_name is not None:
        new_slug = slugify(body.display_name)
        if not new_slug:
            raise HTTPException(status_code=400, detail="Invalid category name")
        # Check slug uniqueness (skip if same category)
        existing = session.exec(
            select(Category).where(Category.slug == new_slug).where(Category.id != category_id)
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Category '{body.display_name}' already exists",
            )
        category.display_name = smart_case(body.display_name)
        category.slug = new_slug

    if body.parent_id is not None:
        if body.parent_id == -1:
            # Sentinel: move to root
            category.parent_id = None
        else:
            # Prevent self-parenting
            if body.parent_id == category_id:
                raise HTTPException(status_code=400, detail="Category cannot be its own parent")
            # Prevent circular: can't parent to own child
            child_ids = {c.id for c in (category.children or [])}
            if body.parent_id in child_ids:
                raise HTTPException(status_code=400, detail="Cannot parent to own child")
            parent = session.get(Category, body.parent_id)
            if not parent:
                raise HTTPException(status_code=404, detail="Parent category not found")
            category.parent_id = body.parent_id
    elif body.model_fields_set and "parent_id" in body.model_fields_set:
        # Explicitly set to None -> move to root
        category.parent_id = None

    if body.weight is not None:
        if body.weight == "inherit":
            category.weight = None
        elif body.weight not in VALID_WEIGHTS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid weight '{body.weight}'. Must be one of: {', '.join(VALID_WEIGHTS)} or 'inherit'",
            )
        else:
            category.weight = body.weight

    if body.is_hidden is not None:
        category.is_hidden = body.is_hidden

    if body.is_seen is not None:
        category.is_seen = body.is_seen

    session.add(category)
    session.commit()
    session.refresh(category)

    return _category_to_response(session, category)


@app.delete("/api/categories/{category_id}")
def delete_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Delete a category. Children are released to root."""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Release children to root
    children = session.exec(
        select(Category).where(Category.parent_id == category_id)
    ).all()
    for child in children:
        child.parent_id = None
        session.add(child)

    # Delete article-category links explicitly
    from sqlalchemy import delete as sa_delete
    session.exec(sa_delete(ArticleCategoryLink).where(ArticleCategoryLink.category_id == category_id))

    # Delete the category
    session.delete(category)
    session.commit()

    return {"ok": True}


@app.post("/api/categories/merge")
def merge_categories(
    body: CategoryMerge,
    session: Session = Depends(get_session),
):
    """Merge source category into target. Moves article associations, reparents children, deletes source."""
    if body.source_id == body.target_id:
        raise HTTPException(status_code=400, detail="Source and target must be different")

    source = session.get(Category, body.source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source category not found")

    target = session.get(Category, body.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target category not found")

    # Move article associations from source to target
    source_links = session.exec(
        select(ArticleCategoryLink).where(ArticleCategoryLink.category_id == body.source_id)
    ).all()

    articles_moved = 0
    for link in source_links:
        # Check if target link already exists for this article
        existing = session.exec(
            select(ArticleCategoryLink)
            .where(ArticleCategoryLink.article_id == link.article_id)
            .where(ArticleCategoryLink.category_id == body.target_id)
        ).first()
        if existing:
            # Already linked to target, just delete source link
            session.delete(link)
        else:
            # Move: delete old, create new (composite PK can't be updated)
            session.delete(link)
            new_link = ArticleCategoryLink(
                article_id=link.article_id,
                category_id=body.target_id,
            )
            session.add(new_link)
        articles_moved += 1

    # Reparent source's children to target
    source_children = session.exec(
        select(Category).where(Category.parent_id == body.source_id)
    ).all()
    for child in source_children:
        child.parent_id = body.target_id
        session.add(child)

    # Delete source category
    session.delete(source)
    session.commit()

    return {"ok": True, "articles_moved": articles_moved}


@app.get("/api/categories/new-count")
def get_new_category_count(
    session: Session = Depends(get_session),
):
    """Get count of unseen, non-hidden categories (for badges)."""
    count = session.exec(
        select(func.count(Category.id))
        .where(Category.is_seen.is_(False))
        .where(Category.is_hidden.is_(False))
    ).one()

    return {"count": count}


@app.post("/api/categories/acknowledge")
def acknowledge_categories(
    body: CategoryAcknowledgeRequest,
    session: Session = Depends(get_session),
):
    """Mark categories as seen by ID."""
    for cat_id in body.category_ids:
        category = session.get(Category, cat_id)
        if category:
            category.is_seen = True
            session.add(category)

    session.commit()

    return {"ok": True}


@app.patch("/api/categories/{category_id}/hide", response_model=CategoryResponse)
def hide_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Hide a category and set weight to block."""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category.is_hidden = True
    category.weight = "block"
    session.add(category)
    session.commit()
    session.refresh(category)

    return _category_to_response(session, category)


@app.patch("/api/categories/{category_id}/unhide", response_model=CategoryResponse)
def unhide_category(
    category_id: int,
    session: Session = Depends(get_session),
):
    """Unhide a category. Reset weight to inherit if it was block."""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category.is_hidden = False
    if category.weight == "block":
        category.weight = None
    session.add(category)
    session.commit()
    session.refresh(category)

    return _category_to_response(session, category)


@app.post("/api/scoring/rescore")
async def rescore_articles(
    session: Session = Depends(get_session),
):
    """Manually trigger re-scoring of recent unread articles."""
    from backend.scheduler import scoring_queue

    queued = await scoring_queue.enqueue_recent_for_rescoring(session)
    return {"queued": queued}


@app.get("/api/scoring/status")
def get_scoring_status(
    session: Session = Depends(get_session),
):
    """Get counts of articles by scoring state, plus live activity phase."""
    from backend.scoring import get_scoring_activity

    # Query counts by scoring_state
    states = ["unscored", "queued", "scoring", "scored", "failed"]
    counts = {}

    for state in states:
        count = session.exec(
            select(func.count(Article.id)).where(Article.scoring_state == state)
        ).one()
        counts[state] = count

    # Add blocked count: scored articles with composite_score == 0
    blocked_count = session.exec(
        select(func.count(Article.id))
        .where(Article.scoring_state == "scored")
        .where(Article.composite_score == 0)
    ).one()
    counts["blocked"] = blocked_count

    # Add live scoring activity (ephemeral phase tracking)
    activity = get_scoring_activity()
    counts["current_article_id"] = activity["article_id"]
    counts["phase"] = activity["phase"]

    return counts


# --- Ollama Configuration Endpoints ---


@app.get("/api/ollama/health", response_model=OllamaHealthResponse)
async def ollama_health():
    """Check Ollama server connectivity, version, and latency."""
    result = await ollama_service.check_health(settings.ollama.host)
    return OllamaHealthResponse(**result)


@app.get("/api/ollama/models", response_model=list[OllamaModelResponse])
async def ollama_models():
    """List locally available Ollama models with loaded status."""
    models = await ollama_service.list_models(settings.ollama.host)
    return [OllamaModelResponse(**m) for m in models]


@app.post("/api/ollama/models/pull")
async def ollama_pull_model(request: PullModelRequest):
    """Pull (download) a model from Ollama registry. Returns SSE stream."""

    async def event_stream():
        try:
            async for chunk in ollama_service.pull_model_stream(
                settings.ollama.host, request.model
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
            yield f"data: {json.dumps({'status': 'complete'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/ollama/models/pull/cancel")
async def ollama_cancel_pull():
    """Cancel an active model download."""
    ollama_service.cancel_download()
    return {"status": "cancelled"}


@app.delete("/api/ollama/models/{name:path}")
async def ollama_delete_model(name: str):
    """Delete a model from Ollama. Uses path type for names with colons."""
    try:
        result = await ollama_service.delete_model(settings.ollama.host, name)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.get("/api/ollama/download-status")
async def ollama_download_status():
    """Get current download state for navigate-away resilience."""
    return ollama_service.get_download_status()


@app.get("/api/ollama/config", response_model=OllamaConfigResponse)
def get_ollama_config(
    session: Session = Depends(get_session),
):
    """Get runtime Ollama model config from UserPreferences (YAML fallback)."""
    preferences = session.exec(select(UserPreferences)).first()

    categorization_model = settings.ollama.categorization_model
    scoring_model = settings.ollama.scoring_model
    use_separate_models = False

    if preferences:
        categorization_model = (
            preferences.ollama_categorization_model or categorization_model
        )
        use_separate_models = preferences.ollama_use_separate_models
        if use_separate_models:
            scoring_model = preferences.ollama_scoring_model or scoring_model
        else:
            scoring_model = categorization_model

    return OllamaConfigResponse(
        categorization_model=categorization_model,
        scoring_model=scoring_model,
        use_separate_models=use_separate_models,
    )


@app.put("/api/ollama/config")
async def update_ollama_config(
    update: OllamaConfigUpdate,
    session: Session = Depends(get_session),
):
    """Save model choices to UserPreferences and optionally enqueue re-scoring."""
    preferences = session.exec(select(UserPreferences)).first()

    if not preferences:
        preferences = UserPreferences(
            interests="",
            anti_interests="",
            updated_at=datetime.now(),
        )
        session.add(preferences)
        session.commit()
        session.refresh(preferences)

    # Determine rescore_mode by comparing old vs new config
    old_cat_model = (
        preferences.ollama_categorization_model or settings.ollama.categorization_model
    )
    old_use_separate = preferences.ollama_use_separate_models
    old_scoring_model = (
        (preferences.ollama_scoring_model or settings.ollama.scoring_model)
        if old_use_separate
        else old_cat_model
    )

    # Save new values (reassign, don't mutate)
    preferences.ollama_categorization_model = update.categorization_model
    preferences.ollama_scoring_model = update.scoring_model
    preferences.ollama_use_separate_models = update.use_separate_models
    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    rescore_queued = 0
    if update.rescore:
        # Determine rescore mode
        new_scoring_model = (
            update.scoring_model
            if update.use_separate_models
            else update.categorization_model
        )
        cat_changed = update.categorization_model != old_cat_model
        score_changed = new_scoring_model != old_scoring_model

        rescore_mode = None
        if cat_changed:
            rescore_mode = "full"
        elif score_changed:
            rescore_mode = "score_only"

        # If user explicitly requested re-evaluation but no model change detected,
        # default to full re-scoring (user intent: "re-score regardless of config")
        if rescore_mode is None:
            rescore_mode = "full"

        if rescore_mode:
            # Enqueue unread scored articles for re-scoring with priority
            articles = session.exec(
                select(Article)
                .where(~Article.is_read)
                .where(Article.scoring_state == "scored")
            ).all()

            for article in articles:
                article.scoring_state = "queued"
                article.scoring_priority = 1
                article.rescore_mode = rescore_mode
                session.add(article)

            session.commit()
            rescore_queued = len(articles)
            logger.info(
                f"Enqueued {rescore_queued} articles for re-scoring (mode={rescore_mode})"
            )

    return {
        "categorization_model": preferences.ollama_categorization_model,
        "scoring_model": preferences.ollama_scoring_model,
        "use_separate_models": preferences.ollama_use_separate_models,
        "rescore_queued": rescore_queued,
    }


@app.get("/api/ollama/prompts", response_model=OllamaPromptsResponse)
def get_ollama_prompts():
    """Get current system prompt templates for categorization and scoring."""
    from backend.prompts import build_categorization_prompt, build_scoring_prompt

    categorization_prompt = build_categorization_prompt(
        "[Article Title]", "[Article Content]", ["example-category"]
    )
    scoring_prompt = build_scoring_prompt(
        "[Article Title]",
        "[Article Content]",
        "[User Interests]",
        "[User Anti-Interests]",
    )

    return OllamaPromptsResponse(
        categorization_prompt=categorization_prompt,
        scoring_prompt=scoring_prompt,
    )
