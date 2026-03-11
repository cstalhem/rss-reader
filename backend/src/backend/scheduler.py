import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select

from backend.config import get_settings
from backend.database import engine
from backend.deps import TASK_CATEGORIZATION, TASK_SCORING, get_task_batch_size
from backend.feeds import refresh_feed
from backend.models import Feed, UserPreferences
from backend.scoring_queue import CategorizationWorker, ScoringWorker

settings = get_settings()
logger = logging.getLogger(__name__)

DEFAULT_FEED_REFRESH_INTERVAL = 1800  # seconds
SCORING_INTERVAL_SECONDS = 30

scheduler = AsyncIOScheduler()
categorization_worker = CategorizationWorker()
scoring_worker = ScoringWorker()


async def refresh_all_feeds():
    """Background job to refresh all feeds."""
    if settings.scheduler.log_job_execution:
        logger.info("Running scheduled feed refresh...")

    with Session(engine) as session:
        feeds = session.exec(select(Feed)).all()

        if not feeds:
            if settings.scheduler.log_job_execution:
                logger.warning("No feeds to refresh")
            return

        for feed in feeds:
            try:
                new_count = await refresh_feed(session, feed)
                if settings.scheduler.log_job_execution:
                    logger.info(f"Refreshed {feed.title}: {new_count} new articles")
            except Exception as e:
                logger.error(f"Failed to refresh {feed.title}: {e}")
                # Continue with other feeds


async def process_pipeline():
    """Background job: run categorization then scoring sequentially."""
    if settings.scheduler.log_job_execution:
        logger.info("Running pipeline processor...")

    with Session(engine) as session:
        session.expire_on_commit = False
        try:
            cat_batch = get_task_batch_size(session, TASK_CATEGORIZATION)
            await categorization_worker.process_next_batch(session, cat_batch)
        except asyncio.CancelledError:
            logger.info("Pipeline cancelled during categorization")
        except Exception as e:
            logger.error(f"Categorization failed: {e}")

    with Session(engine) as session:
        session.expire_on_commit = False
        try:
            score_batch = get_task_batch_size(session, TASK_SCORING)
            await scoring_worker.process_next_batch(session, score_batch)
        except asyncio.CancelledError:
            logger.info("Pipeline cancelled during scoring")
        except Exception as e:
            logger.error(f"Scoring failed: {e}")


def start_scheduler():
    """Start the background scheduler."""
    # Read feed refresh interval from DB
    with Session(engine) as session:
        prefs = session.exec(select(UserPreferences)).first()
        interval_seconds = (
            prefs.feed_refresh_interval if prefs else DEFAULT_FEED_REFRESH_INTERVAL
        )

    scheduler.add_job(
        refresh_all_feeds,
        "interval",
        seconds=interval_seconds,
        id="refresh_feeds",
        replace_existing=True,
    )

    # Add job to process categorization + scoring pipeline
    scheduler.add_job(
        process_pipeline,
        "interval",
        seconds=SCORING_INTERVAL_SECONDS,
        id="process_pipeline",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        f"Scheduler started - feeds will refresh every {interval_seconds} seconds, "
        f"scoring queue will process every {SCORING_INTERVAL_SECONDS} seconds"
    )


def reschedule_feed_refresh(interval_seconds: int):
    """Reschedule the feed refresh job with a new interval."""
    scheduler.reschedule_job(
        "refresh_feeds", trigger="interval", seconds=interval_seconds
    )
    logger.info(f"Feed refresh rescheduled to every {interval_seconds} seconds")


def shutdown_scheduler():
    """Shutdown the scheduler."""
    scheduler.shutdown()
    logger.info("Scheduler shut down")
