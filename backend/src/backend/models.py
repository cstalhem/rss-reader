from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class Feed(SQLModel, table=True):
    """RSS feed source."""

    __tablename__ = "feeds"

    id: int | None = Field(default=None, primary_key=True)
    url: str = Field(unique=True, index=True)
    title: str
    display_order: int = Field(default=0)
    last_fetched_at: datetime | None = None


class Article(SQLModel, table=True):
    """Article from an RSS feed."""

    __tablename__ = "articles"

    model_config = {"arbitrary_types_allowed": True}

    id: int | None = Field(default=None, primary_key=True)
    feed_id: int = Field(foreign_key="feeds.id", index=True, ondelete="CASCADE")
    title: str
    url: str = Field(unique=True, index=True)
    author: str | None = None
    published_at: datetime | None = Field(default=None, index=True)
    summary: str | None = None
    content: str | None = None
    is_read: bool = Field(default=False)

    # LLM scoring fields
    categories: list[str] | None = Field(default=None, sa_column=Column(JSON))
    interest_score: int | None = Field(default=None)
    quality_score: int | None = Field(default=None)
    composite_score: float | None = Field(default=None)
    score_reasoning: str | None = Field(default=None)
    scoring_state: str = Field(default="unscored")
    scored_at: datetime | None = Field(default=None)


class UserPreferences(SQLModel, table=True):
    """User preferences for content curation (single-row table)."""

    __tablename__ = "user_preferences"

    model_config = {"arbitrary_types_allowed": True}

    id: int | None = Field(default=None, primary_key=True)
    interests: str = Field(default="")
    anti_interests: str = Field(default="")
    topic_weights: dict[str, str] | None = Field(default=None, sa_column=Column(JSON))
    updated_at: datetime = Field(default_factory=datetime.now)
