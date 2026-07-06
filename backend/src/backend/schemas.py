"""Pydantic request/response models for all API endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from backend.models import CategoryWeight

# --- General ---


class HealthResponse(BaseModel):
    status: str


class RefreshResponse(BaseModel):
    message: str
    new_articles: int


# --- Articles ---


class ArticleUpdate(BaseModel):
    is_read: bool


class ArticleCategoryEmbed(BaseModel):
    """Category embedded in article response."""

    id: int
    display_name: str
    slug: str
    effective_weight: str
    parent_display_name: str | None


class ArticleListItem(BaseModel):
    """Lightweight article for list endpoints (no content/full summary)."""

    id: int
    feed_id: int
    feed_title: str
    title: str
    url: str
    author: str | None
    published_at: datetime | None
    is_read: bool
    categories: list[ArticleCategoryEmbed] | None
    interest_score: int | None
    quality_score: int | None
    composite_score: float | None
    score_reasoning: str | None
    summary_preview: str | None
    scoring_state: str
    scored_at: datetime | None
    re_evaluating: bool = False


class ArticleListResponse(BaseModel):
    """Envelope for the paginated article list endpoint."""

    items: list[ArticleListItem]
    has_more: bool


class ArticleCountsResponse(BaseModel):
    """Counts for the four article list views, scoped identically to the list endpoint."""

    unread: int
    read: int
    scoring: int
    blocked: int


class ArticleResponse(BaseModel):
    """Full article with content, summary, and score reasoning."""

    id: int
    feed_id: int
    title: str
    url: str
    author: str | None
    published_at: datetime | None
    summary: str | None
    content: str | None
    is_read: bool
    categories: list[ArticleCategoryEmbed] | None
    interest_score: int | None
    quality_score: int | None
    composite_score: float | None
    score_reasoning: str | None
    scoring_state: str
    scored_at: datetime | None
    re_evaluating: bool = False


# --- Feeds ---


class FeedCreate(BaseModel):
    url: str
    is_aggregator: bool = False


class FeedUpdate(BaseModel):
    title: str | None = None
    display_order: int | None = None
    folder_id: int | None = None
    is_aggregator: bool | None = None


class FeedReorder(BaseModel):
    feed_ids: list[int]
    folder_id: int | None = None


class FeedResponse(BaseModel):
    id: int
    url: str
    title: str
    display_order: int
    last_fetched_at: datetime | None
    unread_count: int
    folder_id: int | None = None
    folder_name: str | None = None
    is_aggregator: bool


class FeedFolderCreate(BaseModel):
    name: str
    feed_ids: list[int] = Field(default_factory=list)


class FeedFolderUpdate(BaseModel):
    name: str | None = None
    display_order: int | None = None


class FeedFolderReorder(BaseModel):
    folder_ids: list[int]


class FeedFolderDeleteRequest(BaseModel):
    delete_feeds: bool = False


class FeedFolderResponse(BaseModel):
    id: int
    name: str
    display_order: int
    created_at: datetime
    unread_count: int


# --- Preferences ---


class PreferencesResponse(BaseModel):
    interests: str
    anti_interests: str
    feed_refresh_interval: int
    updated_at: datetime


class PreferencesUpdate(BaseModel):
    interests: str | None = None
    anti_interests: str | None = None
    feed_refresh_interval: int | None = None


# --- Categories ---


class CategoryResponse(BaseModel):
    """Category object returned by API."""

    id: int
    display_name: str
    slug: str
    weight: str
    parent_id: int | None
    needs_triage: bool
    article_count: int


class CategoryCreateRequest(BaseModel):
    display_name: str
    parent_id: int | None = None


class CategoryUpdate(BaseModel):
    display_name: str | None = None
    parent_id: int | None = None
    weight: CategoryWeight | None = None
    needs_triage: bool | None = None


class CategoryBulkUpdate(BaseModel):
    """Collection PATCH body — triage gestures compose from these fields."""

    category_ids: list[int]
    weight: CategoryWeight | None = None
    needs_triage: bool | None = None

    @model_validator(mode="after")
    def require_at_least_one_field(self):
        if self.weight is None and self.needs_triage is None:
            raise ValueError("Provide at least one of weight or needs_triage")
        return self


class CategoryBulkUpdateResponse(BaseModel):
    ok: bool
    updated: int
    missing_ids: list[int]


class CategoryAliasResponse(BaseModel):
    """Alias row for the read-only listing; target_display_name is None for discards."""

    id: int
    alias_slug: str
    target_id: int | None
    target_display_name: str | None
    created_at: datetime


class CategoryMerge(BaseModel):
    source_id: int
    target_id: int


class MergeChildReleased(BaseModel):
    id: int
    display_name: str


class CategoryMergeResponse(BaseModel):
    ok: bool
    articles_moved: int
    children_released: list[MergeChildReleased]
    aliases_repointed: int


class CategoryAcknowledgeRequest(BaseModel):
    category_ids: list[int]


class CategoryBatchMove(BaseModel):
    category_ids: list[int]
    target_parent_id: int


class CategoryBatchAction(BaseModel):
    category_ids: list[int]


# --- Auto-Group ---


class GroupSuggestionItem(BaseModel):
    parent: str
    children: list[str]


class AutoGroupSuggestResponse(BaseModel):
    groups: list[GroupSuggestionItem]


class AutoGroupApplyRequest(BaseModel):
    groups: list[GroupSuggestionItem]


class AutoGroupApplyResponse(BaseModel):
    ok: bool
    groups_applied: int
    categories_moved: int
