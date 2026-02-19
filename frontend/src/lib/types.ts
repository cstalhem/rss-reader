export interface ArticleCategory {
  id: number;
  display_name: string;
  slug: string;
  effective_weight: string;
  parent_display_name: string | null;
}

export interface Category {
  id: number;
  display_name: string;
  slug: string;
  weight: string | null;
  parent_id: number | null;
  is_hidden: boolean;
  is_seen: boolean;
  is_manually_created: boolean;
  article_count: number;
}

export interface Article {
  id: number;
  feed_id: number;
  title: string;
  url: string;
  author: string | null;
  published_at: string | null;
  summary: string | null;
  content: string | null;
  is_read: boolean;
  // LLM scoring fields
  categories: ArticleCategory[] | null;
  interest_score: number | null;
  quality_score: number | null;
  composite_score: number | null;
  score_reasoning: string | null;
  scoring_state: string;
  scored_at: string | null;
}

export interface Feed {
  id: number;
  url: string;
  title: string;
  last_fetched_at: string | null;
  display_order: number;
  unread_count: number;
}

export interface UserPreferences {
  interests: string;
  anti_interests: string;
  updated_at: string;
}

export interface OllamaHealth {
  connected: boolean;
  version: string | null;
  latency_ms: number | null;
}

export interface OllamaModel {
  name: string;
  size: number;
  parameter_size: string | null;
  quantization_level: string | null;
  is_loaded: boolean;
}

export interface OllamaConfig {
  categorization_model: string;
  scoring_model: string;
  use_separate_models: boolean;
}

export interface OllamaPrompts {
  categorization_prompt: string;
  scoring_prompt: string;
}

export interface OllamaConfigSaveResult extends OllamaConfig {
  rescore_queued: number;
}

export type SortOption = "score_desc" | "score_asc" | "date_desc" | "date_asc";

export interface ScoringStatus {
  unscored: number;
  queued: number;
  scoring: number;
  scored: number;
  failed: number;
  blocked: number;
  current_article_id: number | null;
  phase: string;
}

export interface DownloadStatus {
  active: boolean;
  model: string | null;
  completed: number;
  total: number;
  status: string | null;
}

export interface FetchArticlesParams {
  skip?: number;
  limit?: number;
  is_read?: boolean;
  feed_id?: number;
  sort_by?: string;
  order?: string;
  scoring_state?: string;
  exclude_blocked?: boolean;
}
