"""Shared FastAPI dependencies and helper functions."""

import logging
from datetime import datetime

from sqlmodel import Session, select

from backend.database import engine
from backend.models import UserPreferences

logger = logging.getLogger(__name__)

TASK_CATEGORIZATION = "categorization"
TASK_SCORING = "scoring"
TASK_GROUPING = "grouping"


def get_session():
    """FastAPI dependency for database sessions."""
    with Session(engine) as session:
        yield session


def get_or_create_preferences(session: Session) -> UserPreferences:
    """Get existing preferences or create defaults. Used by multiple routers."""
    preferences = session.exec(select(UserPreferences)).first()
    if not preferences:
        preferences = UserPreferences(
            interests="",
            anti_interests="",
            updated_at=datetime.now(),
        )
        session.add(preferences)
        session.commit()
        session.refresh(preferences)
    return preferences
