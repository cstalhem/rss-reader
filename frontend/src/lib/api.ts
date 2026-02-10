import { Article, Feed } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8912";

interface FetchArticlesParams {
  skip?: number;
  limit?: number;
  is_read?: boolean;
  feed_id?: number;
}

export async function fetchArticles(
  params: FetchArticlesParams = {}
): Promise<Article[]> {
  const searchParams = new URLSearchParams();

  if (params.skip !== undefined) {
    searchParams.set("skip", params.skip.toString());
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", params.limit.toString());
  }
  if (params.is_read !== undefined) {
    searchParams.set("is_read", params.is_read.toString());
  }
  if (params.feed_id !== undefined) {
    searchParams.set("feed_id", params.feed_id.toString());
  }

  const url = `${API_BASE_URL}/api/articles${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch articles: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchArticle(id: number): Promise<Article> {
  const response = await fetch(`${API_BASE_URL}/api/articles/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.statusText}`);
  }

  return response.json();
}

export async function updateArticleReadStatus(
  id: number,
  is_read: boolean
): Promise<Article> {
  const response = await fetch(`${API_BASE_URL}/api/articles/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_read }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to update article read status: ${response.statusText}`
    );
  }

  return response.json();
}

export async function fetchFeeds(): Promise<Feed[]> {
  const response = await fetch(`${API_BASE_URL}/api/feeds`);

  if (!response.ok) {
    throw new Error(`Failed to fetch feeds: ${response.statusText}`);
  }

  return response.json();
}

export async function createFeed(url: string): Promise<Feed> {
  const response = await fetch(`${API_BASE_URL}/api/feeds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create feed: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteFeed(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/feeds/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete feed: ${response.statusText}`);
  }
}

export async function updateFeed(
  id: number,
  data: { title?: string; display_order?: number }
): Promise<Feed> {
  const response = await fetch(`${API_BASE_URL}/api/feeds/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to update feed: ${response.statusText}`);
  }

  return response.json();
}

export async function reorderFeeds(feedIds: number[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/feeds/reorder`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feed_ids: feedIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reorder feeds: ${response.statusText}`);
  }
}

export async function markAllFeedRead(feedId: number): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/feeds/${feedId}/mark-all-read`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to mark all feed read: ${response.statusText}`);
  }
}
