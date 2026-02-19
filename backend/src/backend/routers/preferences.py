"""User preferences endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session

from backend.deps import get_or_create_preferences, get_session
from backend.schemas import PreferencesResponse, PreferencesUpdate

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.get("", response_model=PreferencesResponse)
def get_preferences(
    session: Session = Depends(get_session),
):
    """Get user preferences. Creates default preferences if none exist."""
    preferences = get_or_create_preferences(session)

    return PreferencesResponse(
        interests=preferences.interests,
        anti_interests=preferences.anti_interests,
        updated_at=preferences.updated_at,
    )


@router.put("", response_model=PreferencesResponse)
async def update_preferences(
    update: PreferencesUpdate,
    session: Session = Depends(get_session),
):
    """Update user preferences. Merges non-None fields and triggers re-scoring."""
    preferences = get_or_create_preferences(session)

    if update.interests is not None:
        preferences.interests = update.interests

    if update.anti_interests is not None:
        preferences.anti_interests = update.anti_interests

    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    from backend.scheduler import scoring_queue

    scoring_queue.enqueue_recent_for_rescoring(session)

    return PreferencesResponse(
        interests=preferences.interests,
        anti_interests=preferences.anti_interests,
        updated_at=preferences.updated_at,
    )
