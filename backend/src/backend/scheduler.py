import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select

from backend.config import get_settings
from backend.database import engine
from backend.feeds import refresh_feed
from backend.models import Feed, UserPreferences
from backend.scoring_queue import ScoringQueue

settings = get_settings()
logger = logging.getLogger(__name__)

DEFAULT_FEED_REFRESH_INTERVAL = 1800  # seconds
SCORING_BATCH_SIZE = 5
SCORING_INTERVAL_SECONDS = 30

scheduler = AsyncIOScheduler()
scoring_queue = ScoringQueue()


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


async def process_scoring_queue():
    """Background job to process scoring queue."""
    if settings.scheduler.log_job_execution:
        logger.info("Running scoring queue processor...")

    with Session(engine) as session:
        # Prevent lazy-load after commit -- scoring reads article attributes
        # post-commit outside request cycle
        session.expire_on_commit = False
        try:
            processed = await scoring_queue.process_next_batch(
                session,
                batch_size=SCORING_BATCH_SIZE,
            )
            if settings.scheduler.log_job_execution and processed > 0:
                logger.info(f"Processed {processed} articles from scoring queue")
        except asyncio.CancelledError:
            logger.info("Scoring queue processing cancelled")
        except Exception as e:
            logger.error(f"Failed to process scoring queue: {e}")


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

    # Add job to process scoring queue
    scheduler.add_job(
        process_scoring_queue,
        "interval",
        seconds=SCORING_INTERVAL_SECONDS,
        id="process_scoring",
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
