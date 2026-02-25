"""RSS Reader API entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.database import create_db_and_tables
from backend.ollama_client import close_ollama_client
from backend.routers import (
    articles,
    categories,
    feed_folders,
    feeds,
    ollama,
    preferences,
    scoring,
)
from backend.scheduler import shutdown_scheduler, start_scheduler
from backend.schemas import HealthResponse

settings = get_settings()
log_level = getattr(logging, settings.logging.level.upper(), logging.INFO)

logging.basicConfig(
    level=log_level,
    format="%(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and scheduler on startup."""
    logger.info("Starting up...")

    data_dir = os.path.dirname(settings.database.path)
    if data_dir:
        os.makedirs(data_dir, exist_ok=True)

    create_db_and_tables()
    # Alembic logging config can raise root level to WARNING during startup.
    # Re-assert app logger level so scoring/categorization INFO logs stay visible.
    logging.getLogger("backend").setLevel(log_level)
    start_scheduler()

    yield

    shutdown_scheduler()
    await close_ollama_client()
    logger.info("Shutting down...")


app = FastAPI(
    title="RSS Reader API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3210", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(articles.router)
app.include_router(feeds.router)
app.include_router(feed_folders.router)
app.include_router(categories.router)
app.include_router(preferences.router)
app.include_router(ollama.router)
app.include_router(scoring.router)


@app.get("/health", response_model=HealthResponse, status_code=200, tags=["monitoring"])
def health_check():
    """Health check endpoint for monitoring and container orchestration."""
    return HealthResponse(status="healthy")


@app.get("/", status_code=200)
def root():
    """Legacy root health probe used by existing tests/scripts."""
    return {"status": "ok"}
