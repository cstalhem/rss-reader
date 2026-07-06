/** Server response shapes. Mirror the backend Pydantic schemas exactly. */

/** Mirrors backend `FeedResponse` (schemas.py). */
export interface Feed {
  id: number;
  url: string;
  title: string;
  display_order: number;
  last_fetched_at: string | null;
  unread_count: number;
  folder_id: number | null;
  folder_name: string | null;
  is_aggregator: boolean;
}

/** Mirrors backend `FeedCreate` (schemas.py) — body for `POST /api/feeds`. */
export interface FeedCreatePayload {
  url: string;
  is_aggregator?: boolean;
}

/** Mirrors backend `FeedUpdate` (schemas.py) — body for `PATCH /api/feeds/{id}`. */
export interface FeedUpdatePayload {
  title?: string;
  display_order?: number;
  /** A number moves the feed into that folder (appended at end); `null` moves it to root. */
  folder_id?: number | null;
  is_aggregator?: boolean;
}

/** Mirrors backend `FeedFolderResponse` (schemas.py). */
export interface FeedFolder {
  id: number;
  name: string;
  display_order: number;
  created_at: string;
  unread_count: number;
}

/** Mirrors backend `FeedFolderCreate` (schemas.py) — body for `POST /api/feed-folders`. */
export interface FeedFolderCreatePayload {
  name: string;
  feed_ids?: number[];
}

/** Mirrors backend `FeedFolderUpdate` (schemas.py) — body for `PATCH /api/feed-folders/{id}`. */
export interface FeedFolderUpdatePayload {
  name?: string;
  display_order?: number;
}

/** The currently-selected sidebar scope. Client UI state, not server state. */
export type FeedSelection =
  | { type: "all" }
  | { type: "folder"; id: number }
  | { type: "feed"; id: number }
  | { type: "blocked" };

/** The default scope — there is never a "nothing selected" state. */
export const ALL_ARTICLES_SELECTION: FeedSelection = { type: "all" };

/** Mirrors backend `ArticleCategoryEmbed` (schemas.py). */
export interface ArticleCategory {
  id: number;
  display_name: string;
  slug: string;
  /** Weight label ("block" | "reduce" | "normal" | "boost" | "max") — a string, not a number. */
  effective_weight: string;
  parent_display_name: string | null;
  needs_triage: boolean;
}

/** Mirrors backend `ArticleListItem` (schemas.py) — returned by `GET /api/articles`. */
export interface ArticleListItem {
  id: number;
  feed_id: number;
  feed_title: string;
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
  re_evaluating: boolean;
}

/** Mirrors backend response for `GET /api/articles`. */
export interface ArticleListResponse {
  items: ArticleListItem[];
  has_more: boolean;
}

/** Mirrors backend `ArticleResponse` (schemas.py) — returned by article detail/update endpoints. */
export interface Article {
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
  scoring_state: string;
  scored_at: string | null;
  re_evaluating: boolean;
  summary: string | null;
  /** Raw HTML. */
  content: string | null;
}

/** Mirrors backend response for `GET /api/articles/counts`. */
export interface ArticleCounts {
  unread: number;
  read: number;
  scoring: number;
  blocked: number;
}

/** Mirrors backend `CategoryWeight` (models.py) — single source of truth for the weight vocabulary. */
export type CategoryWeight = "block" | "reduce" | "normal" | "boost" | "max";

/** Mirrors backend `TriageSampleArticle` (schemas.py) — evidence shown for a category awaiting triage. */
export interface TriageSampleArticle {
  id: number;
  title: string;
  feed_title: string;
}

/** Mirrors backend `CategoryResponse` (schemas.py). */
export interface Category {
  id: number;
  display_name: string;
  slug: string;
  weight: CategoryWeight;
  parent_id: number | null;
  needs_triage: boolean;
  article_count: number;
  created_at: string;
  /** Populated only when the category was fetched with `needs_triage=true`; otherwise `[]`. */
  sample_articles: TriageSampleArticle[];
}

/** Mirrors backend `CategoryCreateRequest` (schemas.py) — body for `POST /api/categories`. */
export interface CategoryCreatePayload {
  display_name: string;
  parent_id?: number | null;
}

/** Mirrors backend `CategoryUpdate` (schemas.py) — body for `PATCH /api/categories/{id}`. `parent_id: -1` ungroups. */
export interface CategoryUpdatePayload {
  display_name?: string;
  parent_id?: number | null;
  weight?: CategoryWeight;
  needs_triage?: boolean;
}

/** Mirrors backend `CategoryBulkUpdate` (schemas.py) — body for `PATCH /api/categories` (collection). */
export interface CategoryBulkUpdatePayload {
  category_ids: number[];
  weight?: CategoryWeight;
  needs_triage?: boolean;
}

/** Mirrors backend `CategoryBulkUpdateResponse` (schemas.py). */
export interface CategoryBulkUpdateResponse {
  ok: boolean;
  updated: number;
  missing_ids: number[];
}

/**
 * Mirrors backend `CategoryGroupRequest` (schemas.py) — body for `POST /api/categories/group`.
 * Exactly one of `target_parent_id`, `new_parent_name`, `ungroup` must be provided (ADR-0009).
 */
export interface CategoryGroupPayload {
  category_ids: number[];
  target_parent_id?: number;
  new_parent_name?: string;
  ungroup?: boolean;
}

/** Mirrors backend response for `POST /api/categories/group`. */
export interface CategoryGroupResponse {
  ok: boolean;
  updated: number;
}

/** Mirrors backend `CategoryMerge` (schemas.py) — body for `POST /api/categories/merge`. */
export interface CategoryMergePayload {
  source_id: number;
  target_id: number;
}

/** Mirrors backend `MergeChildReleased` (schemas.py). */
export interface MergeChildReleased {
  id: number;
  display_name: string;
}

/** Mirrors backend `CategoryMergeResponse` (schemas.py). */
export interface CategoryMergeResponse {
  ok: boolean;
  articles_moved: number;
  children_released: MergeChildReleased[];
  aliases_repointed: number;
}

/** Mirrors backend `GroupSuggestionItem` (schemas.py). */
export interface GroupSuggestionItem {
  parent: string;
  children: string[];
}

/** Mirrors backend response for `POST /api/categories/auto-group/suggest`. */
export interface AutoGroupSuggestResponse {
  groups: GroupSuggestionItem[];
}

/** Mirrors backend `AutoGroupApplyRequest` (schemas.py) — body for `POST /api/categories/auto-group/apply`. */
export interface AutoGroupApplyPayload {
  groups: GroupSuggestionItem[];
}

/** Mirrors backend `AutoGroupApplyResponse` (schemas.py). */
export interface AutoGroupApplyResponse {
  ok: boolean;
  groups_applied: number;
  categories_moved: number;
}
