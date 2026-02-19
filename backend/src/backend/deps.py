"""Shared FastAPI dependencies and helper functions."""

from datetime import datetime

from sqlmodel import Session, select

from backend.config import get_settings
from backend.database import engine
from backend.models import UserPreferences

settings = get_settings()


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


def resolve_ollama_models(preferences: UserPreferences) -> tuple[str, str]:
    """Resolve categorization and scoring model names from preferences + config fallback.

    Returns:
        Tuple of (categorization_model, scoring_model)
    """
    categorization_model = (
        preferences.ollama_categorization_model
        or settings.ollama.categorization_model
    )
    if preferences.ollama_use_separate_models:
        scoring_model = (
            preferences.ollama_scoring_model or settings.ollama.scoring_model
        )
    else:
        scoring_model = categorization_model
    return categorization_model, scoring_model
