"""Shared FastAPI dependencies and helper functions."""

import logging
from datetime import datetime

from sqlalchemy import ColumnElement
from sqlmodel import Session, select

from backend.database import engine
from backend.models import Article, UserPreferences

logger = logging.getLogger(__name__)

TASK_CATEGORIZATION = "categorization"
TASK_SCORING = "scoring"
TASK_GROUPING = "grouping"


def get_session():
    """FastAPI dependency for database sessions."""
    with Session(engine) as session:
        yield session


def unread_condition() -> ColumnElement[bool]:
    """The single definition of "unread": scored, non-blocked, unread.

    Matches CONTEXT.md's "Unread" entry — blocking is the only suppression
    axis, so a scored zero-score article is still unread (visible and counted).
    Shared by the articles list/counts endpoints and the feeds/feed-folders
    unread_count aggregates so there is exactly one definition in the codebase.
    """
    return (
        Article.is_read.is_(False)  # pyright: ignore[reportAttributeAccessIssue]
    ) & (Article.scoring_state == "scored")


def read_condition() -> ColumnElement[bool]:
    """Scored, non-blocked articles that have been read."""
    return (
        Article.is_read.is_(True)  # pyright: ignore[reportAttributeAccessIssue]
    ) & (Article.scoring_state == "scored")


def scoring_pending_condition() -> ColumnElement[bool]:
    """Articles awaiting first-time categorization/scoring (excludes re-evaluating)."""
    return (
        Article.composite_score.is_(None)  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
    ) & (
        Article.scoring_state.in_(["unscored", "queued", "scoring"])  # pyright: ignore[reportAttributeAccessIssue]
        | Article.categorization_state.in_(["queued", "categorizing"])  # pyright: ignore[reportAttributeAccessIssue]
    )


def blocked_condition() -> ColumnElement[bool]:
    """Articles blocked by a category weight."""
    return Article.scoring_state == "blocked"  # pyright: ignore[reportReturnType]


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
