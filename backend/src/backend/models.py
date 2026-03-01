from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint
from sqlmodel import Field, Relationship, SQLModel


class FeedFolder(SQLModel, table=True):
    """Folder grouping for RSS feeds."""

    __tablename__ = "feed_folders"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now)

    feeds: list["Feed"] = Relationship(  # noqa: UP037
        back_populates="folder"
    )


class Feed(SQLModel, table=True):
    """RSS feed source."""

    __tablename__ = "feeds"

    id: int | None = Field(default=None, primary_key=True)
    url: str = Field(unique=True, index=True)
    title: str
    display_order: int = Field(default=0)
    last_fetched_at: datetime | None = None
    folder_id: int | None = Field(
        default=None,
        foreign_key="feed_folders.id",
        ondelete="SET NULL",
        index=True,
    )

    folder: FeedFolder | None = Relationship(back_populates="feeds")


class ArticleCategoryLink(SQLModel, table=True):
    """Junction table for many-to-many Article <-> Category."""

    __tablename__ = "article_category_link"

    article_id: int = Field(
        foreign_key="articles.id", primary_key=True, ondelete="CASCADE"
    )
    category_id: int = Field(
        foreign_key="categories.id", primary_key=True, ondelete="CASCADE"
    )


class Category(SQLModel, table=True):
    """A topic category for articles."""

    __tablename__ = "categories"

    id: int | None = Field(default=None, primary_key=True)
    display_name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    parent_id: int | None = Field(default=None, foreign_key="categories.id")
    weight: str | None = Field(default=None)
    is_hidden: bool = Field(default=False)
    is_seen: bool = Field(default=False)
    is_manually_created: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)

    # Relationships
    articles: list["Article"] = Relationship(  # noqa: UP037
        back_populates="categories_rel",
        link_model=ArticleCategoryLink,
    )
    parent: Optional["Category"] = Relationship(  # noqa: UP045, UP037
        sa_relationship_kwargs={
            "remote_side": "Category.id",
            "foreign_keys": "[Category.parent_id]",
        }
    )
    children: list["Category"] = Relationship(  # noqa: UP037
        sa_relationship_kwargs={
            "foreign_keys": "[Category.parent_id]",
            "overlaps": "parent",
        }
    )


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

    # LLM scoring fields
    interest_score: int | None = Field(default=None)
    quality_score: int | None = Field(default=None)
    composite_score: float | None = Field(default=None, index=True)
    score_reasoning: str | None = Field(default=None)
    scoring_state: str = Field(default="unscored", index=True)
    scored_at: datetime | None = Field(default=None)

    # Re-scoring support
    scoring_priority: int = Field(default=0)
    rescore_mode: str | None = Field(default=None)

    # Relationships
    categories_rel: list[Category] = Relationship(
        back_populates="articles",
        link_model=ArticleCategoryLink,
    )


class UserPreferences(SQLModel, table=True):
    """User preferences for content curation (single-row table)."""

    __tablename__ = "user_preferences"

    id: int | None = Field(default=None, primary_key=True)
    interests: str = Field(default="")
    anti_interests: str = Field(default="")
    use_separate_models: bool = Field(default=False)
    updated_at: datetime = Field(default_factory=datetime.now)

    # Scheduler configuration
    feed_refresh_interval: int = Field(default=1800)  # seconds


class LLMProviderConfig(SQLModel, table=True):
    """Provider-specific runtime configuration."""

    __tablename__ = "llm_provider_configs"
    __table_args__ = (CheckConstraint("json_valid(config_json)"),)

    id: int | None = Field(default=None, primary_key=True)
    provider: str = Field(unique=True, index=True)
    enabled: bool = Field(default=True)
    config_json: str
    updated_at: datetime = Field(default_factory=datetime.now)


class LLMTaskRoute(SQLModel, table=True):
    """Route each LLM task to a specific provider and model."""

    __tablename__ = "llm_task_routes"

    id: int | None = Field(default=None, primary_key=True)
    task: str = Field(unique=True, index=True)
    provider: str = Field(
        foreign_key="llm_provider_configs.provider",
        index=True,
    )
    model: str | None = Field(default=None)
    updated_at: datetime = Field(default_factory=datetime.now)
