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
  weight: string;
  parent_id: number | null;
  needs_triage: boolean;
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
  re_evaluating?: boolean;
}

/** Lightweight article for list views (no content/full summary). */
export interface ArticleListItem {
  id: number;
  feed_id: number;
  title: string;
  url: string;
  author: string | null;
  published_at: string | null;
  is_read: boolean;
  categories: ArticleCategory[] | null;
  interest_score: number | null;
  quality_score: number | null;
  composite_score: number | null;
  score_reasoning: string | null;
  summary_preview: string | null;
  scoring_state: string;
  scored_at: string | null;
  re_evaluating?: boolean;
}

export interface Feed {
  id: number;
  url: string;
  title: string;
  last_fetched_at: string | null;
  display_order: number;
  unread_count: number;
  folder_id: number | null;
  folder_name: string | null;
}

export interface FeedFolder {
  id: number;
  name: string;
  display_order: number;
  created_at: string;
  unread_count: number;
}

export type FeedSelection =
  | { kind: "all" }
  | { kind: "feed"; feedId: number }
  | { kind: "folder"; folderId: number };

export const ALL_FEEDS_SELECTION: FeedSelection = { kind: "all" };

export function isFeedSelected(
  selection: FeedSelection,
  feedId: number
): boolean {
  return selection.kind === "feed" && selection.feedId === feedId;
}

export interface UserPreferences {
  interests: string;
  anti_interests: string;
  feed_refresh_interval: number;
  updated_at: string;
}

export interface RefreshStatus {
  next_refresh_at: string | null;
}

export interface RescoreResult {
  ok: boolean;
  rescore_queued: number;
}

export type TimeUnit = "seconds" | "minutes" | "hours";

export type SortOption = "score_desc" | "score_asc" | "date_desc" | "date_asc";

export type FilterTab = "unread" | "all" | "scoring" | "blocked" | "failed";

export interface ScoringStatus {
  unscored: number;
  queued: number;
  scoring: number;
  scored: number;
  failed: number;
  blocked: number;
  current_article_id: number | null;
  phase: string;
  categorization_ready: boolean;
  categorization_ready_reason: string | null;
  score_ready: boolean;
  score_ready_reason: string | null;
  scoring_ready: boolean;
  scoring_ready_reason: string | null;
  rate_limit_retry_after: number | null;
  categorization?: {
    uncategorized: number;
    queued: number;
    categorizing: number;
    categorized: number;
    failed: number;
    ready: boolean;
    ready_reason: string | null;
    phase: string;
    rate_limit_retry_after: number | null;
  };
  scoring_worker?: {
    ready: boolean;
    ready_reason: string | null;
    phase: string;
    rate_limit_retry_after: number | null;
  };
}

export interface GroupSuggestion {
  parent: string;
  children: string[];
}

export interface AutoGroupSuggestResponse {
  groups: GroupSuggestion[];
}

export interface AutoGroupApplyResponse {
  ok: boolean;
  groups_applied: number;
  categories_moved: number;
}

export interface FetchArticlesParams {
  skip?: number;
  limit?: number;
  is_read?: boolean;
  feed_id?: number;
  folder_id?: number;
  sort_by?: string;
  order?: string;
  scoring_state?: string;
  exclude_blocked?: boolean;
}
