from datetime import datetime
from enum import StrEnum
from typing import Optional

from sqlalchemy import CheckConstraint
from sqlmodel import Field, Relationship, SQLModel


class CategoryWeight(StrEnum):
    """The category weight vocabulary — single source of truth.

    The DB CHECK constraint, request validation, and the scoring
    multiplier table all derive from these members.
    """

    BLOCK = "block"
    REDUCE = "reduce"
    NORMAL = "normal"
    BOOST = "boost"
    MAX = "max"


FEEDBACK_EVENT_TYPES = ("opened", "marked_read", "rated", "rescued")
CATEGORIZATION_STATES = (
    "uncategorized",
    "queued",
    "categorizing",
    "categorized",
    "failed",
)
SCORING_STATES = ("unscored", "queued", "scoring", "scored", "blocked", "failed")


def _in_clause(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


class FeedFolder(SQLModel, table=True):
    """Folder grouping for RSS feeds."""

    __tablename__ = "feed_folders"  # pyright: ignore[reportAssignmentType]

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now)

    feeds: list["Feed"] = Relationship(  # noqa: UP037
        back_populates="folder"
    )


class Feed(SQLModel, table=True):
    """RSS feed source."""

    __tablename__ = "feeds"  # pyright: ignore[reportAssignmentType]

    id: int | None = Field(default=None, primary_key=True)
    url: str = Field(unique=True, index=True)
    title: str
    display_order: int = Field(default=0)
    last_fetched_at: datetime | None = None
    is_aggregator: bool = Field(default=False)
    folder_id: int | None = Field(
        default=None,
        foreign_key="feed_folders.id",
        ondelete="SET NULL",
        index=True,
    )

    folder: FeedFolder | None = Relationship(back_populates="feeds")


class ArticleCategoryLink(SQLModel, table=True):
    """Junction table for many-to-many Article <-> Category."""

    __tablename__ = "article_category_link"  # pyright: ignore[reportAssignmentType]

    article_id: int = Field(
        foreign_key="articles.id", primary_key=True, ondelete="CASCADE"
    )
    category_id: int = Field(
        foreign_key="categories.id", primary_key=True, ondelete="CASCADE"
    )


class Category(SQLModel, table=True):
    """A topic category for articles.

    Weight is the only suppression axis (ADR-0001): there is no hidden state.
    """

    __tablename__ = "categories"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        CheckConstraint(
            _in_clause("weight", tuple(w.value for w in CategoryWeight)),
            name="ck_categories_weight",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    display_name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    parent_id: int | None = Field(default=None, foreign_key="categories.id")
    weight: str = Field(default="normal")
    needs_triage: bool = Field(default=False)
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


class CategoryAlias(SQLModel, table=True):
    """Alias memory for merged/renamed/deleted category names (ADR-0001).

    A NULL target means "discard": proposals matching alias_slug are dropped.
    ON DELETE SET NULL degrades aliases into discards when their target dies.
    """

    __tablename__ = "category_aliases"  # pyright: ignore[reportAssignmentType]

    id: int | None = Field(default=None, primary_key=True)
    alias_slug: str = Field(unique=True, index=True)
    target_id: int | None = Field(
        default=None,
        foreign_key="categories.id",
        ondelete="SET NULL",
    )
    created_at: datetime = Field(default_factory=datetime.now)


class Article(SQLModel, table=True):
    """Article from an RSS feed."""

    __tablename__ = "articles"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        CheckConstraint(
            _in_clause("categorization_state", CATEGORIZATION_STATES),
            name="ck_articles_categorization_state",
        ),
        CheckConstraint(
            _in_clause("scoring_state", SCORING_STATES),
            name="ck_articles_scoring_state",
        ),
        CheckConstraint(
            "rescore_mode IS NULL OR rescore_mode IN ('score_only')",
            name="ck_articles_rescore_mode",
        ),
        CheckConstraint(
            "rating IS NULL OR rating IN (-1, 1)",
            name="ck_articles_rating",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    feed_id: int = Field(foreign_key="feeds.id", index=True, ondelete="CASCADE")
    title: str
    url: str = Field(unique=True, index=True)
    author: str | None = None
    published_at: datetime | None = Field(default=None, index=True)
    summary: str | None = None
    content: str | None = None
    content_markdown: str | None = None
    linked_content_markdown: str | None = None
    linked_fetched_at: datetime | None = Field(default=None)
    is_read: bool = Field(default=False)
    rating: int | None = Field(default=None)

    # LLM scoring fields
    interest_score: int | None = Field(default=None)
    quality_score: int | None = Field(default=None)
    composite_score: float | None = Field(default=None, index=True)
    score_reasoning: str | None = Field(default=None)
    scoring_state: str = Field(default="unscored", index=True)
    scored_at: datetime | None = Field(default=None)
    rescued_at: datetime | None = Field(default=None)

    # Re-scoring support
    scoring_priority: int = Field(default=0)
    rescore_mode: str | None = Field(default=None)

    # Categorization pipeline
    categorization_state: str = Field(default="uncategorized", index=True)
    categorization_attempts: int = Field(default=0)
    scoring_attempts: int = Field(default=0)

    # Relationships
    categories_rel: list[Category] = Relationship(
        back_populates="articles",
        link_model=ArticleCategoryLink,
    )


class FeedbackEvent(SQLModel, table=True):
    """Append-only record of a fact about user behavior.

    Events record facts only; interpreting them into preference signals
    is the learning layer's job. Only 'rated' carries a value (+1/-1).
    """

    __tablename__ = "feedback_events"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        CheckConstraint(
            _in_clause("event_type", FEEDBACK_EVENT_TYPES),
            name="ck_feedback_events_event_type",
        ),
        CheckConstraint(
            "value IS NULL OR value IN (-1, 1)",
            name="ck_feedback_events_value",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    article_id: int = Field(foreign_key="articles.id", index=True, ondelete="CASCADE")
    event_type: str
    value: int | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)


class UserPreferences(SQLModel, table=True):
    """User preferences for content curation (single-row table)."""

    __tablename__ = "user_preferences"  # pyright: ignore[reportAssignmentType]

    id: int | None = Field(default=None, primary_key=True)
    interests: str = Field(default="")
    anti_interests: str = Field(default="")
    updated_at: datetime = Field(default_factory=datetime.now)

    # Scheduler configuration
    feed_refresh_interval: int = Field(default=1800)  # seconds
