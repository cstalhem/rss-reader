import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import select

from backend.config import get_settings
from backend.database import get_session
from backend.feeds import refresh_feed
from backend.models import Feed
from backend.scoring_queue import ScoringQueue

settings = get_settings()
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()
scoring_queue = ScoringQueue()


async def refresh_all_feeds():
    """Background job to refresh all feeds."""
    if settings.scheduler.log_job_execution:
        logger.info("Running scheduled feed refresh...")

    with next(get_session()) as session:
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

    with next(get_session()) as session:
        try:
            processed = await scoring_queue.process_next_batch(session, batch_size=5)
            if settings.scheduler.log_job_execution and processed > 0:
                logger.info(f"Processed {processed} articles from scoring queue")
        except Exception as e:
            logger.error(f"Failed to process scoring queue: {e}")


def start_scheduler():
    """Start the background scheduler."""
    # Add job to refresh feeds at configured interval
    interval_seconds = settings.scheduler.feed_refresh_interval
    scheduler.add_job(
        refresh_all_feeds,
        "interval",
        seconds=interval_seconds,
        id="refresh_feeds",
        replace_existing=True,
    )

    # Add job to process scoring queue every 30 seconds
    scheduler.add_job(
        process_scoring_queue,
        "interval",
        seconds=30,
        id="process_scoring",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        f"Scheduler started - feeds will refresh every {interval_seconds} seconds, "
        f"scoring queue will process every 30 seconds"
    )


def shutdown_scheduler():
    """Shutdown the scheduler."""
    scheduler.shutdown()
    logger.info("Scheduler shut down")
