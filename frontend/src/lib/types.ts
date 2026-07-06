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
