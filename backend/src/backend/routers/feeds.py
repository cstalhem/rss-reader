"""Feed CRUD and refresh endpoints."""

import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlmodel import Session, func, select

from backend.deps import get_session
from backend.feeds import fetch_feed, refresh_feed, save_articles
from backend.models import Article, Feed, FeedFolder
from backend.schemas import (
    FeedCreate,
    FeedReorder,
    FeedResponse,
    FeedUpdate,
    RefreshResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/feeds", tags=["feeds"])


@router.get("", response_model=list[FeedResponse])
def list_feeds(
    session: Session = Depends(get_session),
):
    """List all feeds with unread count, ordered by display_order."""
    # Single query: LEFT JOIN + GROUP BY to get unread counts per feed.
    # unread_count only includes scored, non-blocked, unread articles
    # (matches what the frontend displays).
    statement = (
        select(
            Feed,
            FeedFolder.name.label("folder_name"),
            func.count(Article.id).label("unread_count"),
        )
        .outerjoin(FeedFolder, FeedFolder.id == Feed.folder_id)
        .outerjoin(
            Article,
            (Article.feed_id == Feed.id)
            & (Article.is_read.is_(False))
            & (Article.scoring_state == "scored")
            & (Article.composite_score > 0),
        )
        .group_by(Feed.id, FeedFolder.name)
        .order_by(Feed.folder_id, Feed.display_order, Feed.id)
    )
    results = session.exec(statement).all()

    return [
        FeedResponse(
            id=feed.id,
            url=feed.url,
            title=feed.title,
            display_order=feed.display_order,
            last_fetched_at=feed.last_fetched_at,
            unread_count=unread_count,
            folder_id=feed.folder_id,
            folder_name=folder_name,
        )
        for feed, folder_name, unread_count in results
    ]


@router.post("", response_model=FeedResponse, status_code=201)
async def create_feed(
    feed_create: FeedCreate,
    session: Session = Depends(get_session),
):
    """Create a new feed by URL, validate it, and fetch initial articles."""
    url = feed_create.url.strip()

    if not url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="Invalid URL format. Must start with http:// or https://",
        )

    existing_feed = session.exec(select(Feed).where(Feed.url == url)).first()

    if existing_feed:
        raise HTTPException(
            status_code=400,
            detail="Feed with this URL already exists",
        )

    try:
        parsed_feed = await fetch_feed(url)

        if parsed_feed.bozo and not parsed_feed.entries:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid RSS feed or feed has no entries: {parsed_feed.get('bozo_exception', 'Unknown error')}",
            )

    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, OSError) as e:
        logger.error(f"Failed to fetch feed {url}: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch feed: {str(e)}",
        ) from e

    max_order_result = session.exec(
        select(func.max(Feed.display_order)).where(Feed.folder_id.is_(None))
    ).one()
    next_order = (max_order_result or 0) + 1

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

    article_count, new_article_ids = save_articles(
        session, feed.id, parsed_feed.entries
    )
    logger.info(f"Created feed {feed.title} with {article_count} articles")

    if new_article_ids:
        from backend.scheduler import scoring_queue

        scoring_queue.enqueue_articles(session, new_article_ids)

    return FeedResponse(
        id=feed.id,
        url=feed.url,
        title=feed.title,
        display_order=feed.display_order,
        last_fetched_at=feed.last_fetched_at,
        unread_count=article_count,
        folder_id=feed.folder_id,
        folder_name=None,
    )


@router.put("/order")
def reorder_feeds(
    feed_reorder: FeedReorder,
    session: Session = Depends(get_session),
):
    """Reorder feeds within a folder bucket (or root if folder_id is null)."""
    if len(feed_reorder.feed_ids) != len(set(feed_reorder.feed_ids)):
        raise HTTPException(
            status_code=400, detail="Duplicate feed IDs are not allowed"
        )

    if feed_reorder.folder_id is not None:
        folder = session.get(FeedFolder, feed_reorder.folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    bucket_statement = select(Feed.id)
    if feed_reorder.folder_id is None:
        bucket_statement = bucket_statement.where(Feed.folder_id.is_(None))
    else:
        bucket_statement = bucket_statement.where(
            Feed.folder_id == feed_reorder.folder_id
        )

    bucket_feed_ids = set(session.exec(bucket_statement).all())
    requested_feed_ids = set(feed_reorder.feed_ids)
    if requested_feed_ids != bucket_feed_ids:
        raise HTTPException(
            status_code=400,
            detail="Feed reorder must include all feeds in the selected folder bucket",
        )

    for index, feed_id in enumerate(feed_reorder.feed_ids):
        feed = session.get(Feed, feed_id)
        if feed is not None:
            feed.display_order = index
            session.add(feed)

    session.commit()
    return {"ok": True}


@router.get("/refresh-status")
def get_refresh_status():
    """Get next scheduled feed refresh time for countdown display."""
    from backend.scheduler import scheduler

    job = scheduler.get_job("refresh_feeds")
    return {
        "next_refresh_at": job.next_run_time.isoformat()
        if job and job.next_run_time
        else None,
    }


@router.post("/refresh", response_model=RefreshResponse)
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

    return RefreshResponse(
        message=f"Refreshed {len(feeds)} feed(s)",
        new_articles=total_new,
    )


@router.delete("/{feed_id}")
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


@router.patch("/{feed_id}", response_model=FeedResponse)
def update_feed(
    feed_id: int,
    feed_update: FeedUpdate,
    session: Session = Depends(get_session),
):
    """Update feed title, display_order, and/or folder assignment."""
    feed = session.get(Feed, feed_id)

    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    if feed_update.title is not None:
        feed.title = feed_update.title

    if feed_update.display_order is not None:
        feed.display_order = feed_update.display_order

    if "folder_id" in feed_update.model_fields_set:
        if feed_update.folder_id is not None:
            folder = session.get(FeedFolder, feed_update.folder_id)
            if not folder:
                raise HTTPException(status_code=404, detail="Folder not found")

        if feed.folder_id != feed_update.folder_id:
            target_bucket_max_order_statement = select(func.max(Feed.display_order))
            if feed_update.folder_id is None:
                target_bucket_max_order_statement = (
                    target_bucket_max_order_statement.where(Feed.folder_id.is_(None))
                )
            else:
                target_bucket_max_order_statement = (
                    target_bucket_max_order_statement.where(
                        Feed.folder_id == feed_update.folder_id
                    )
                )

            target_bucket_max_order = session.exec(
                target_bucket_max_order_statement
            ).one()

            feed.folder_id = feed_update.folder_id
            feed.display_order = (target_bucket_max_order or 0) + 1

    session.add(feed)
    session.commit()
    session.refresh(feed)

    unread_count = session.exec(
        select(func.count(Article.id))
        .where(Article.feed_id == feed.id)
        .where(Article.is_read.is_(False))
        .where(Article.scoring_state == "scored")
        .where(Article.composite_score > 0)
    ).one()

    folder_name = None
    if feed.folder_id is not None:
        folder = session.get(FeedFolder, feed.folder_id)
        folder_name = folder.name if folder else None

    return FeedResponse(
        id=feed.id,
        url=feed.url,
        title=feed.title,
        display_order=feed.display_order,
        last_fetched_at=feed.last_fetched_at,
        unread_count=unread_count,
        folder_id=feed.folder_id,
        folder_name=folder_name,
    )


@router.post("/{feed_id}/mark-read")
def mark_feed_read(
    feed_id: int,
    session: Session = Depends(get_session),
):
    """Mark all articles in a feed as read."""
    feed = session.get(Feed, feed_id)

    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    result = session.exec(
        update(Article)
        .where(Article.feed_id == feed_id)
        .where(Article.is_read.is_(False))
        .values(is_read=True)
    )
    session.commit()

    return {"ok": True, "count": result.rowcount}
