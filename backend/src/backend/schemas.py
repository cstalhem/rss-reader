"""Pydantic request/response models for all API endpoints."""

from datetime import datetime

from pydantic import BaseModel

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
    """Lightweight article for list endpoints (no content/summary/score_reasoning)."""

    id: int
    feed_id: int
    title: str
    url: str
    author: str | None
    published_at: datetime | None
    is_read: bool
    categories: list[ArticleCategoryEmbed] | None
    interest_score: int | None
    quality_score: int | None
    composite_score: float | None
    scoring_state: str
    scored_at: datetime | None


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


# --- Feeds ---


class FeedCreate(BaseModel):
    url: str


class FeedUpdate(BaseModel):
    title: str | None = None
    display_order: int | None = None


class FeedReorder(BaseModel):
    feed_ids: list[int]


class FeedResponse(BaseModel):
    id: int
    url: str
    title: str
    display_order: int
    last_fetched_at: datetime | None
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
    weight: str | None
    parent_id: int | None
    is_hidden: bool
    is_seen: bool
    is_manually_created: bool
    article_count: int


class CategoryCreateRequest(BaseModel):
    display_name: str
    parent_id: int | None = None


class CategoryUpdate(BaseModel):
    display_name: str | None = None
    parent_id: int | None = None
    weight: str | None = None
    is_hidden: bool | None = None
    is_seen: bool | None = None


class CategoryMerge(BaseModel):
    source_id: int
    target_id: int


class CategoryAcknowledgeRequest(BaseModel):
    category_ids: list[int]


class CategoryBatchMove(BaseModel):
    category_ids: list[int]
    target_parent_id: int


class CategoryBatchAction(BaseModel):
    category_ids: list[int]


# --- Ollama ---


class OllamaHealthResponse(BaseModel):
    connected: bool
    version: str | None
    latency_ms: int | None


class OllamaModelResponse(BaseModel):
    name: str
    size: int
    parameter_size: str | None
    quantization_level: str | None
    is_loaded: bool


class PullModelRequest(BaseModel):
    model: str


class OllamaConfigResponse(BaseModel):
    categorization_model: str | None
    scoring_model: str | None
    use_separate_models: bool
    thinking: bool


class OllamaConfigUpdate(BaseModel):
    categorization_model: str | None
    scoring_model: str | None
    use_separate_models: bool
    thinking: bool


class OllamaPromptsResponse(BaseModel):
    categorization_prompt: str
    scoring_prompt: str
