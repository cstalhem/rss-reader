"""User preferences endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from backend.deps import get_or_create_preferences, get_session
from backend.schemas import PreferencesResponse, PreferencesUpdate

router = APIRouter(prefix="/api/preferences", tags=["preferences"])

MIN_REFRESH_INTERVAL = 60  # 1 minute
MAX_REFRESH_INTERVAL = 14400  # 4 hours


@router.get("", response_model=PreferencesResponse)
def get_preferences(
    session: Session = Depends(get_session),
):
    """Get user preferences. Creates default preferences if none exist."""
    preferences = get_or_create_preferences(session)

    return PreferencesResponse(
        interests=preferences.interests,
        anti_interests=preferences.anti_interests,
        feed_refresh_interval=preferences.feed_refresh_interval,
        updated_at=preferences.updated_at,
    )


@router.put("", response_model=PreferencesResponse)
async def update_preferences(
    update: PreferencesUpdate,
    session: Session = Depends(get_session),
):
    """Update user preferences. Merges non-None fields and triggers re-scoring."""
    preferences = get_or_create_preferences(session)

    rescoring_needed = False

    if update.interests is not None:
        preferences.interests = update.interests
        rescoring_needed = True

    if update.anti_interests is not None:
        preferences.anti_interests = update.anti_interests
        rescoring_needed = True

    if update.feed_refresh_interval is not None:
        if not (
            MIN_REFRESH_INTERVAL <= update.feed_refresh_interval <= MAX_REFRESH_INTERVAL
        ):
            raise HTTPException(
                status_code=422,
                detail=f"feed_refresh_interval must be between {MIN_REFRESH_INTERVAL} and {MAX_REFRESH_INTERVAL} seconds",
            )
        preferences.feed_refresh_interval = update.feed_refresh_interval

    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    if rescoring_needed:
        from backend.scheduler import scoring_queue

        scoring_queue.enqueue_recent_for_rescoring(session)

    if update.feed_refresh_interval is not None:
        from backend.scheduler import reschedule_feed_refresh

        reschedule_feed_refresh(update.feed_refresh_interval)

    return PreferencesResponse(
        interests=preferences.interests,
        anti_interests=preferences.anti_interests,
        feed_refresh_interval=preferences.feed_refresh_interval,
        updated_at=preferences.updated_at,
    )
