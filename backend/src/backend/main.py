import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.config import get_settings
from backend.database import create_db_and_tables, get_session
from backend.feeds import refresh_feed
from backend.models import Article, Feed
from backend.scheduler import shutdown_scheduler, start_scheduler

settings = get_settings()

# Configure logging from settings
logging.basicConfig(
    level=getattr(logging, settings.logging.level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Hardcoded feed URL for MVP
HARDCODED_FEED_URL = "https://simonwillison.net/atom/everything/"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and seed data on startup."""
    logger.info("Starting up...")

    # Ensure data directory exists (extract from database path)
    data_dir = os.path.dirname(settings.database.path)
    if data_dir:  # Only create if path has a directory component
        os.makedirs(data_dir, exist_ok=True)

    # Create tables
    create_db_and_tables()

    # Seed the hardcoded feed if it doesn't exist
    with next(get_session()) as session:
        existing_feed = session.exec(
            select(Feed).where(Feed.url == HARDCODED_FEED_URL)
        ).first()

        if not existing_feed:
            feed = Feed(
                url=HARDCODED_FEED_URL,
                title="Simon Willison's Weblog",
            )
            session.add(feed)
            session.commit()
            logger.info(f"Seeded feed: {feed.title}")
        else:
            logger.info(f"Feed already exists: {existing_feed.title}")

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
    allow_origins=["http://localhost:3210"],
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
    session: Session = Depends(get_session),
):
    """
    List articles, paginated and sorted by published_at desc.

    Query params:
        skip: Number of articles to skip (default: 0)
        limit: Maximum number of articles to return (default: 50)
        is_read: Filter by read status (optional). If not provided, returns all articles.
    """
    statement = select(Article).order_by(Article.published_at.desc())

    if is_read is not None:
        statement = statement.where(Article.is_read == is_read)

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


