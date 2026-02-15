import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import desc, nulls_last
from sqlmodel import Session, func, select

from backend import ollama_service
from backend.config import get_settings
from backend.database import create_db_and_tables, get_session
from backend.feeds import fetch_feed, refresh_feed, save_articles
from backend.models import Article, Feed, UserPreferences
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
    topic_weights: dict[str, str] | None
    category_groups: dict | None = None
    updated_at: datetime


class PreferencesUpdate(BaseModel):
    interests: str | None = None
    anti_interests: str | None = None
    topic_weights: dict[str, str] | None = None


class CategoryWeightUpdate(BaseModel):
    weight: str


class CategoryGroupsResponse(BaseModel):
    groups: list[dict] = []
    hidden_categories: list[str] = []
    seen_categories: list[str] = []
    returned_categories: list[str] = []


class CategoryGroupsUpdate(BaseModel):
    groups: list[dict] = []
    hidden_categories: list[str] = []
    seen_categories: list[str] = []
    returned_categories: list[str] = []


class CategoryAcknowledge(BaseModel):
    categories: list[str]


class NewCategoryCountResponse(BaseModel):
    count: int
    returned_count: int


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
    statement = select(Article)

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
    return articles


@app.get("/api/articles/{article_id}")
def get_article(
    article_id: int,
    session: Session = Depends(get_session),
):
    """Get a single article by ID with full content."""
    article = session.get(Article, article_id)

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return article


@app.patch("/api/articles/{article_id}")
def update_article(
    article_id: int,
    update: ArticleUpdate,
    session: Session = Depends(get_session),
):
    """Update article read status."""
    article = session.get(Article, article_id)

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.is_read = update.is_read
    session.add(article)
    session.commit()
    session.refresh(article)

    return article


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
    preferences = session.exec(select(UserPreferences)).first()

    if not preferences:
        # Create default preferences with seed category weights
        from backend.prompts import get_default_topic_weights

        preferences = UserPreferences(
            interests="",
            anti_interests="",
            topic_weights=get_default_topic_weights(),
            updated_at=datetime.now(),
        )
        session.add(preferences)
        session.commit()
        session.refresh(preferences)

    return PreferencesResponse(
        interests=preferences.interests,
        anti_interests=preferences.anti_interests,
        topic_weights=preferences.topic_weights,
        category_groups=preferences.category_groups,
        updated_at=preferences.updated_at,
    )


@app.put("/api/preferences", response_model=PreferencesResponse)
async def update_preferences(
    update: PreferencesUpdate,
    session: Session = Depends(get_session),
):
    """Update user preferences. Merges non-None fields and triggers re-scoring."""
    preferences = session.exec(select(UserPreferences)).first()

    if not preferences:
        # Create if doesn't exist with seed category weights
        from backend.prompts import get_default_topic_weights

        preferences = UserPreferences(
            interests="",
            anti_interests="",
            topic_weights=get_default_topic_weights(),
            updated_at=datetime.now(),
        )
        session.add(preferences)

    # Update non-None fields
    if update.interests is not None:
        preferences.interests = update.interests

    if update.anti_interests is not None:
        preferences.anti_interests = update.anti_interests

    if update.topic_weights is not None:
        preferences.topic_weights = update.topic_weights

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
        topic_weights=preferences.topic_weights,
        category_groups=preferences.category_groups,
        updated_at=preferences.updated_at,
    )


@app.get("/api/categories")
def get_categories(
    session: Session = Depends(get_session),
):
    """Get list of unique categories, seeded with defaults."""
    from backend.prompts import DEFAULT_CATEGORIES

    # Start with default seed categories
    categories_seen = {cat.lower(): cat for cat in DEFAULT_CATEGORIES}

    # Merge in categories from scored articles (overrides preserve article casing)
    articles = session.exec(
        select(Article).where(Article.categories.is_not(None))
    ).all()
    for article in articles:
        if article.categories:
            for category in article.categories:
                categories_seen[category.lower()] = category

    return sorted(categories_seen.values(), key=str.lower)


@app.patch("/api/categories/{category_name}/weight", response_model=PreferencesResponse)
def update_category_weight(
    category_name: str,
    weight_update: CategoryWeightUpdate,
    session: Session = Depends(get_session),
):
    """Update weight for a single category.

    Accepts weight values: block, reduce, normal, boost, max
    (also accepts legacy names: blocked, low, neutral, medium, high)
    """
    valid_weights = {
        "block", "reduce", "normal", "boost", "max",
        "blocked", "low", "neutral", "medium", "high",
    }
    if weight_update.weight not in valid_weights:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid weight '{weight_update.weight}'. Must be one of: block, reduce, normal, boost, max",
        )

    preferences = _get_or_create_preferences(session)

    # Reassign dict to ensure SQLAlchemy detects the change on JSON column
    new_weights = dict(preferences.topic_weights or {})
    new_weights[category_name.lower()] = weight_update.weight
    preferences.topic_weights = new_weights
    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    return PreferencesResponse(
        interests=preferences.interests,
        anti_interests=preferences.anti_interests,
        topic_weights=preferences.topic_weights,
        category_groups=preferences.category_groups,
        updated_at=preferences.updated_at,
    )


# --- Category Group Management Endpoints ---


def _get_or_create_preferences(session: Session) -> UserPreferences:
    """Get existing preferences or create defaults. Shared by category endpoints."""
    preferences = session.exec(select(UserPreferences)).first()
    if not preferences:
        from backend.prompts import get_default_topic_weights

        preferences = UserPreferences(
            interests="",
            anti_interests="",
            topic_weights=get_default_topic_weights(),
            updated_at=datetime.now(),
        )
        session.add(preferences)
        session.commit()
        session.refresh(preferences)
    return preferences


def _get_category_groups(preferences: UserPreferences) -> dict:
    """Get category_groups from preferences, returning default structure if null."""
    if preferences.category_groups:
        return preferences.category_groups
    return {
        "groups": [],
        "hidden_categories": [],
        "seen_categories": [],
        "returned_categories": [],
    }


@app.get("/api/categories/groups", response_model=CategoryGroupsResponse)
def get_category_groups(
    session: Session = Depends(get_session),
):
    """Get the category groups structure from UserPreferences."""
    preferences = _get_or_create_preferences(session)
    cg = _get_category_groups(preferences)
    return CategoryGroupsResponse(**cg)


@app.put("/api/categories/groups", response_model=CategoryGroupsResponse)
async def update_category_groups(
    update: CategoryGroupsUpdate,
    session: Session = Depends(get_session),
):
    """Save full category_groups JSON and trigger re-scoring."""
    preferences = _get_or_create_preferences(session)

    # Reassign entire dict (SQLAlchemy JSON mutation rule)
    preferences.category_groups = update.model_dump()
    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    # Trigger re-scoring since weight changes affect scores
    from backend.scheduler import scoring_queue

    await scoring_queue.enqueue_recent_for_rescoring(session)

    cg = _get_category_groups(preferences)
    return CategoryGroupsResponse(**cg)


@app.patch("/api/categories/{name}/hide", response_model=CategoryGroupsResponse)
def hide_category(
    name: str,
    session: Session = Depends(get_session),
):
    """Hide a category: add to hidden_categories, remove from groups and topic_weights."""
    preferences = _get_or_create_preferences(session)
    cg = _get_category_groups(preferences)
    cat_lower = name.lower()

    # Add to hidden_categories if not already there
    hidden = list(cg.get("hidden_categories", []))
    if cat_lower not in [h.lower() for h in hidden]:
        hidden.append(cat_lower)

    # Remove from any group's categories list
    groups = []
    for group in cg.get("groups", []):
        new_cats = [c for c in group.get("categories", []) if c.lower() != cat_lower]
        groups.append({**group, "categories": new_cats})

    # Reassign category_groups
    preferences.category_groups = {
        **cg,
        "hidden_categories": hidden,
        "groups": groups,
    }

    # Remove from topic_weights
    if preferences.topic_weights and cat_lower in preferences.topic_weights:
        new_weights = {k: v for k, v in preferences.topic_weights.items() if k != cat_lower}
        preferences.topic_weights = new_weights

    preferences.updated_at = datetime.now()
    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    return CategoryGroupsResponse(**_get_category_groups(preferences))


@app.patch("/api/categories/{name}/unhide", response_model=CategoryGroupsResponse)
def unhide_category(
    name: str,
    session: Session = Depends(get_session),
):
    """Unhide a category: remove from hidden_categories and returned_categories."""
    preferences = _get_or_create_preferences(session)
    cg = _get_category_groups(preferences)
    cat_lower = name.lower()

    # Remove from hidden_categories
    hidden = [h for h in cg.get("hidden_categories", []) if h.lower() != cat_lower]

    # Remove from returned_categories
    returned = [r for r in cg.get("returned_categories", []) if r.lower() != cat_lower]

    preferences.category_groups = {
        **cg,
        "hidden_categories": hidden,
        "returned_categories": returned,
    }
    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    return CategoryGroupsResponse(**_get_category_groups(preferences))


@app.get("/api/categories/new-count", response_model=NewCategoryCountResponse)
def get_new_category_count(
    session: Session = Depends(get_session),
):
    """Get count of categories not yet seen by the user (for badges)."""
    from backend.prompts import DEFAULT_CATEGORIES

    preferences = _get_or_create_preferences(session)
    cg = _get_category_groups(preferences)

    # Collect all known categories
    all_categories: set[str] = set()

    # From articles
    articles = session.exec(
        select(Article).where(Article.categories.is_not(None))
    ).all()
    for article in articles:
        if article.categories:
            for cat in article.categories:
                all_categories.add(cat.lower())

    # From topic_weights
    if preferences.topic_weights:
        for cat in preferences.topic_weights:
            all_categories.add(cat.lower())

    # From group categories
    for group in cg.get("groups", []):
        for cat in group.get("categories", []):
            all_categories.add(cat.lower())

    # From defaults
    for cat in DEFAULT_CATEGORIES:
        all_categories.add(cat.lower())

    # Subtract seen and hidden
    seen = {s.lower() for s in cg.get("seen_categories", [])}
    hidden = {h.lower() for h in cg.get("hidden_categories", [])}
    new_categories = all_categories - seen - hidden

    # Returned count
    returned = cg.get("returned_categories", [])

    return NewCategoryCountResponse(
        count=len(new_categories),
        returned_count=len(returned),
    )


@app.post("/api/categories/acknowledge")
def acknowledge_categories(
    body: CategoryAcknowledge,
    session: Session = Depends(get_session),
):
    """Mark categories as seen (dismiss 'New' badges)."""
    preferences = _get_or_create_preferences(session)
    cg = _get_category_groups(preferences)

    # Add to seen_categories
    seen = list(cg.get("seen_categories", []))
    seen_lower = {s.lower() for s in seen}
    for cat in body.categories:
        if cat.lower() not in seen_lower:
            seen.append(cat.lower())
            seen_lower.add(cat.lower())

    # Remove from returned_categories
    ack_lower = {c.lower() for c in body.categories}
    returned = [r for r in cg.get("returned_categories", []) if r.lower() not in ack_lower]

    preferences.category_groups = {
        **cg,
        "seen_categories": seen,
        "returned_categories": returned,
    }
    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()

    return {"ok": True}


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
        from backend.prompts import get_default_topic_weights

        preferences = UserPreferences(
            interests="",
            anti_interests="",
            topic_weights=get_default_topic_weights(),
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
