import type {
  Article,
  ArticleCounts,
  ArticleListResponse,
  Feed,
  FeedFolder,
  FeedSelection,
} from "./types";

/**
 * All API URLs are relative. Dev uses a next.config rewrite that proxies
 * `/api/*` to the backend; production uses a reverse proxy that routes
 * `PathPrefix('/api')` to the backend. There is deliberately no base-URL env var.
 */

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
  throw new Error(message);
}

export async function fetchFeeds(): Promise<Feed[]> {
  const response = await fetch("/api/feeds");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch feeds");
  }

  return response.json();
}

export async function fetchFeedFolders(): Promise<FeedFolder[]> {
  const response = await fetch("/api/feed-folders");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch feed folders");
  }

  return response.json();
}

export async function fetchArticles(
  selection: FeedSelection,
  skip: number,
  limit: number,
): Promise<ArticleListResponse> {
  const params = new URLSearchParams({
    is_read: "false",
    skip: String(skip),
    limit: String(limit),
  });
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

export async function fetchArticleCounts(): Promise<ArticleCounts> {
  const response = await fetch("/api/articles/counts");

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch article counts");
  }

  return response.json();
}
