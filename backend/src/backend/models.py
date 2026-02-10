from datetime import datetime

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

    id: int | None = Field(default=None, primary_key=True)
    feed_id: int = Field(foreign_key="feeds.id", index=True, ondelete="CASCADE")
    title: str
    url: str = Field(unique=True, index=True)
    author: str | None = None
    published_at: datetime | None = Field(default=None, index=True)
    summary: str | None = None
    content: str | None = None
    is_read: bool = Field(default=False)
