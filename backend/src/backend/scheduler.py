import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import select

from backend.database import get_session
from backend.feeds import refresh_feed
from backend.models import Feed

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def refresh_all_feeds():
    """Background job to refresh all feeds."""
    logger.info("Running scheduled feed refresh...")

    with next(get_session()) as session:
        feeds = session.exec(select(Feed)).all()

        if not feeds:
            logger.warning("No feeds to refresh")
            return

        for feed in feeds:
            try:
                new_count = await refresh_feed(session, feed)
                logger.info(f"Refreshed {feed.title}: {new_count} new articles")
            except Exception as e:
                logger.error(f"Failed to refresh {feed.title}: {e}")
                # Continue with other feeds


def start_scheduler():
    """Start the background scheduler."""
    # Add job to refresh feeds every 30 minutes
    scheduler.add_job(
        refresh_all_feeds,
        "interval",
        minutes=30,
        id="refresh_feeds",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started - feeds will refresh every 30 minutes")


def shutdown_scheduler():
    """Shutdown the scheduler."""
    scheduler.shutdown()
    logger.info("Scheduler shut down")
