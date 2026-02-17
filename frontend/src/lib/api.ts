import {
  Article,
  Feed,
  UserPreferences,
  CategoryGroups,
  OllamaHealth,
  OllamaModel,
  OllamaConfig,
  OllamaConfigSaveResult,
  OllamaPrompts,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8912";

interface FetchArticlesParams {
  skip?: number;
  limit?: number;
  is_read?: boolean;
  feed_id?: number;
  sort_by?: string;
  order?: string;
  scoring_state?: string;
  exclude_blocked?: boolean;
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
  if (params.sort_by !== undefined) {
    searchParams.set("sort_by", params.sort_by);
  }
  if (params.order !== undefined) {
    searchParams.set("order", params.order);
  }
  if (params.scoring_state !== undefined) {
    searchParams.set("scoring_state", params.scoring_state);
  }
  if (params.exclude_blocked !== undefined) {
    searchParams.set("exclude_blocked", params.exclude_blocked.toString());
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

export async function fetchPreferences(): Promise<UserPreferences> {
  const response = await fetch(`${API_BASE_URL}/api/preferences`);

  if (!response.ok) {
    throw new Error(`Failed to fetch preferences: ${response.statusText}`);
  }

  return response.json();
}

export async function updatePreferences(
  data: Partial<UserPreferences>
): Promise<UserPreferences> {
  const response = await fetch(`${API_BASE_URL}/api/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to update preferences: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchCategories(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories`);

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  return response.json();
}

export async function updateCategoryWeight(
  category: string,
  weight: string
): Promise<UserPreferences> {
  const response = await fetch(
    `${API_BASE_URL}/api/categories/${encodeURIComponent(category)}/weight`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ weight }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to update category weight: ${response.statusText}`
    );
  }

  return response.json();
}

// --- Category Groups API ---

export async function fetchCategoryGroups(): Promise<CategoryGroups> {
  const response = await fetch(`${API_BASE_URL}/api/categories/groups`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch category groups: ${response.statusText}`
    );
  }

  return response.json();
}

export async function saveCategoryGroups(
  data: CategoryGroups
): Promise<CategoryGroups> {
  const response = await fetch(`${API_BASE_URL}/api/categories/groups`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to save category groups: ${response.statusText}`
    );
  }

  return response.json();
}

export async function hideCategory(name: string): Promise<CategoryGroups> {
  const response = await fetch(
    `${API_BASE_URL}/api/categories/${encodeURIComponent(name)}/hide`,
    {
      method: "PATCH",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to hide category: ${response.statusText}`);
  }

  return response.json();
}

export async function unhideCategory(name: string): Promise<CategoryGroups> {
  const response = await fetch(
    `${API_BASE_URL}/api/categories/${encodeURIComponent(name)}/unhide`,
    {
      method: "PATCH",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to unhide category: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchNewCategoryCount(): Promise<{
  count: number;
  returned_count: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/categories/new-count`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch new category count: ${response.statusText}`
    );
  }

  return response.json();
}

export async function acknowledgeCategories(
  categories: string[]
): Promise<{ ok: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/api/categories/acknowledge`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ categories }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to acknowledge categories: ${response.statusText}`
    );
  }

  return response.json();
}

export async function createCategory(name: string): Promise<{ name: string }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to create category: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteCategory(name: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete category: ${response.statusText}`);
  }
  return response.json();
}

export async function renameCategory(
  oldName: string,
  newName: string
): Promise<{ old_name: string; new_name: string }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_name: oldName, new_name: newName }),
  });
  if (!response.ok) {
    throw new Error(`Failed to rename category: ${response.statusText}`);
  }
  return response.json();
}

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

export async function fetchScoringStatus(): Promise<ScoringStatus> {
  const response = await fetch(`${API_BASE_URL}/api/scoring/status`);

  if (!response.ok) {
    throw new Error(`Failed to fetch scoring status: ${response.statusText}`);
  }

  return response.json();
}

// --- Ollama Configuration API ---

export async function fetchOllamaHealth(): Promise<OllamaHealth> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/health`);

  if (!response.ok) {
    throw new Error(`Failed to fetch Ollama health: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchOllamaModels(): Promise<OllamaModel[]> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/models`);

  if (!response.ok) {
    throw new Error(`Failed to fetch Ollama models: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchOllamaConfig(): Promise<OllamaConfig> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/config`);

  if (!response.ok) {
    throw new Error(`Failed to fetch Ollama config: ${response.statusText}`);
  }

  return response.json();
}

export async function saveOllamaConfig(
  data: OllamaConfig & { rescore: boolean }
): Promise<OllamaConfigSaveResult> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to save Ollama config: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchOllamaPrompts(): Promise<OllamaPrompts> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/prompts`);

  if (!response.ok) {
    throw new Error(`Failed to fetch Ollama prompts: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteOllamaModel(name: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/ollama/models/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete Ollama model: ${response.statusText}`);
  }
}

export interface DownloadStatus {
  active: boolean;
  model: string | null;
  completed: number;
  total: number;
  status: string | null;
}

export async function fetchDownloadStatus(): Promise<DownloadStatus> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/download-status`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch download status: ${response.statusText}`
    );
  }

  return response.json();
}
