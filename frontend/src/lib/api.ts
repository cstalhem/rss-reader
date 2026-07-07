import type {
  Article,
  ArticleCounts,
  ArticleListResponse,
  AutoGroupApplyPayload,
  AutoGroupApplyResponse,
  AutoGroupSuggestResponse,
  Category,
  CategoryBulkUpdatePayload,
  CategoryBulkUpdateResponse,
  CategoryGroupPayload,
  CategoryGroupResponse,
  CategoryMergePayload,
  CategoryMergeResponse,
  CategoryUpdatePayload,
  Feed,
  FeedCreatePayload,
  FeedFolder,
  FeedFolderCreatePayload,
  FeedFolderUpdatePayload,
  FeedSelection,
  FeedUpdatePayload,
  Preferences,
  PreferencesUpdate,
  ReadFilter,
  ScoringStatus,
} from "./types";

/**
 * All API URLs are relative. Dev uses a next.config rewrite that proxies
 * `/api/*` to the backend; production uses a reverse proxy that routes
 * `PathPrefix('/api')` to the backend. There is deliberately no base-URL env var.
 */

/** Carries the HTTP status alongside the message so callers can branch on it (e.g. 409 name-collision). Extends `Error`, so the centralized MutationCache toast (which reads `.message`) is unaffected. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Throw an error with the backend's `detail` message if available, otherwise fall back to a generic message. */
export async function throwApiError(
  response: Response,
  fallback: string,
): Promise<never> {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  const message = Array.isArray(detail)
    ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join("; ")
    : typeof detail === "string"
      ? detail
      : `${fallback}: ${response.statusText}`;
  throw new ApiError(message, response.status);
}

export async function fetchFeeds(): Promise<Feed[]> {
  const response = await fetch("/api/feeds");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch feeds");
  }

  return response.json();
}

export async function addFeed(payload: FeedCreatePayload): Promise<Feed> {
  const response = await fetch("/api/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to add feed");
  }

  return response.json();
}

export async function updateFeed(
  id: number,
  payload: FeedUpdatePayload,
): Promise<Feed> {
  const response = await fetch(`/api/feeds/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to update feed");
  }

  return response.json();
}

export async function deleteFeed(id: number): Promise<void> {
  const response = await fetch(`/api/feeds/${id}`, { method: "DELETE" });

  if (!response.ok) {
    await throwApiError(response, "Failed to delete feed");
  }
}

export async function fetchFeedFolders(): Promise<FeedFolder[]> {
  const response = await fetch("/api/feed-folders");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch feed folders");
  }

  return response.json();
}

export async function createFolder(
  payload: FeedFolderCreatePayload,
): Promise<FeedFolder> {
  const response = await fetch("/api/feed-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to create folder");
  }

  return response.json();
}

export async function updateFolder(
  id: number,
  payload: FeedFolderUpdatePayload,
): Promise<FeedFolder> {
  const response = await fetch(`/api/feed-folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to update folder");
  }

  return response.json();
}

export async function deleteFolder(
  id: number,
  deleteFeeds: boolean = false,
): Promise<void> {
  const params = new URLSearchParams({ delete_feeds: String(deleteFeeds) });
  const response = await fetch(`/api/feed-folders/${id}?${params.toString()}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to delete folder");
  }
}

export async function fetchArticles(
  selection: FeedSelection,
  filter: ReadFilter,
  skip: number,
  limit: number,
): Promise<ArticleListResponse> {
  const params = new URLSearchParams({
    is_read: filter === "read" ? "true" : "false",
    skip: String(skip),
    limit: String(limit),
  });
  if (filter === "read") {
    // Read articles sort by recency; unread keeps the backend's default
    // composite_score desc ordering.
    params.set("sort_by", "published_at");
    params.set("order", "desc");
  }
  if (selection.type === "feed") {
    params.set("feed_id", String(selection.id));
  } else if (selection.type === "folder") {
    params.set("folder_id", String(selection.id));
  }

  const response = await fetch(`/api/articles?${params.toString()}`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch articles");
  }

  return response.json();
}

export async function fetchBlockedArticles(
  skip: number,
  limit: number,
): Promise<ArticleListResponse> {
  const params = new URLSearchParams({
    scoring_state: "blocked",
    skip: String(skip),
    limit: String(limit),
  });

  const response = await fetch(`/api/articles?${params.toString()}`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch blocked articles");
  }

  return response.json();
}

export async function rescueArticle(id: number): Promise<void> {
  const response = await fetch(`/api/articles/${id}/rescue`, {
    method: "POST",
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to rescue article");
  }
}

export async function fetchArticle(id: number): Promise<Article> {
  const response = await fetch(`/api/articles/${id}`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch article");
  }

  return response.json();
}

export async function updateArticleRead(
  id: number,
  isRead: boolean,
): Promise<Article> {
  const response = await fetch(`/api/articles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_read: isRead }),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to update article");
  }

  return response.json();
}

export async function rateArticle(
  id: number,
  value: 1 | -1 | null,
): Promise<Article> {
  const response = await fetch(`/api/articles/${id}/rating`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to rate article");
  }

  return response.json();
}

export async function fetchArticleCounts(): Promise<ArticleCounts> {
  const response = await fetch("/api/articles/counts");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch article counts");
  }

  return response.json();
}

export async function fetchCategories(
  needsTriage?: boolean,
): Promise<Category[]> {
  const params =
    needsTriage === undefined
      ? ""
      : `?${new URLSearchParams({ needs_triage: String(needsTriage) }).toString()}`;
  const response = await fetch(`/api/categories${params}`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch categories");
  }

  return response.json();
}

export async function fetchCategoryUnseenCount(): Promise<{ count: number }> {
  const response = await fetch("/api/categories/unseen-count");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch category unseen count");
  }

  return response.json();
}

export async function updateCategory(
  id: number,
  payload: CategoryUpdatePayload,
): Promise<Category> {
  const response = await fetch(`/api/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to update category");
  }

  return response.json();
}

export async function bulkUpdateCategories(
  payload: CategoryBulkUpdatePayload,
): Promise<CategoryBulkUpdateResponse> {
  const response = await fetch("/api/categories", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to update categories");
  }

  return response.json();
}

export async function groupCategories(
  payload: CategoryGroupPayload,
): Promise<CategoryGroupResponse> {
  const response = await fetch("/api/categories/group", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to group categories");
  }

  return response.json();
}

export async function mergeCategories(
  payload: CategoryMergePayload,
): Promise<CategoryMergeResponse> {
  const response = await fetch("/api/categories/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to merge categories");
  }

  return response.json();
}

export async function autoGroupSuggest(): Promise<AutoGroupSuggestResponse> {
  const response = await fetch("/api/categories/auto-group/suggest", {
    method: "POST",
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to suggest category groups");
  }

  return response.json();
}

export async function autoGroupApply(
  payload: AutoGroupApplyPayload,
): Promise<AutoGroupApplyResponse> {
  const response = await fetch("/api/categories/auto-group/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to apply category groups");
  }

  return response.json();
}

export async function fetchPreferences(): Promise<Preferences> {
  const response = await fetch("/api/preferences");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch preferences");
  }

  return response.json();
}

export async function updatePreferences(
  update: PreferencesUpdate,
): Promise<Preferences> {
  const response = await fetch("/api/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to update preferences");
  }

  return response.json();
}

export async function fetchScoringStatus(): Promise<ScoringStatus> {
  const response = await fetch("/api/scoring/status");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch scoring status");
  }

  return response.json();
}
