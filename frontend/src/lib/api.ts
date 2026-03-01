import {
  Article,
  ArticleListItem,
  AvailableModel,
  Category,
  DownloadStatus,
  Feed,
  FetchArticlesParams,
  OllamaConfig,
  OllamaHealth,
  OllamaModel,
  OllamaPrompts,
  ProviderListItem,
  RefreshStatus,
  RescoreResult,
  ScoringStatus,
  TaskRoutesResponse,
  TaskRoutesUpdate,
  UserPreferences,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8912";

/** Throw an error with the backend's `detail` message if available, otherwise fall back to a generic message. */
async function throwApiError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  const message = Array.isArray(detail)
    ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join("; ")
    : typeof detail === "string"
      ? detail
      : `${fallback}: ${response.statusText}`;
  throw new Error(message);
}

export async function fetchArticles(
  params: FetchArticlesParams = {}
): Promise<ArticleListItem[]> {
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
    await throwApiError(response, "Failed to fetch articles");
  }

  return response.json();
}

export async function fetchArticle(id: number): Promise<Article> {
  const response = await fetch(`${API_BASE_URL}/api/articles/${id}`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch article");
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
    await throwApiError(response, "Failed to update article read status");
  }

  return response.json();
}

export async function rescoreArticle(
  articleId: number
): Promise<{ ok: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/api/articles/${articleId}/rescore`,
    { method: "POST" }
  );

  if (!response.ok) {
    await throwApiError(response, "Failed to rescore article");
  }

  return response.json();
}

export async function markAllArticlesRead(): Promise<{
  ok: boolean;
  count: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/articles/mark-all-read`, {
    method: "POST",
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to mark all articles read");
  }

  return response.json();
}

export async function fetchFeeds(): Promise<Feed[]> {
  const response = await fetch(`${API_BASE_URL}/api/feeds`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch feeds");
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
    await throwApiError(response, "Failed to create feed");
  }

  return response.json();
}

export async function deleteFeed(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/feeds/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to delete feed");
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
    await throwApiError(response, "Failed to update feed");
  }

  return response.json();
}

export async function reorderFeeds(feedIds: number[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/feeds/order`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feed_ids: feedIds }),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to reorder feeds");
  }
}

export async function markAllFeedRead(feedId: number): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/feeds/${feedId}/mark-read`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    await throwApiError(response, "Failed to mark all feed read");
  }
}

export async function fetchPreferences(): Promise<UserPreferences> {
  const response = await fetch(`${API_BASE_URL}/api/preferences`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch preferences");
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
    await throwApiError(response, "Failed to update preferences");
  }

  return response.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories`);
  if (!response.ok) await throwApiError(response, "Failed to fetch categories");
  return response.json();
}

export async function updateCategory(
  id: number,
  data: { display_name?: string; parent_id?: number | null; weight?: string | null; is_hidden?: boolean; is_seen?: boolean }
): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) await throwApiError(response, "Failed to update category");
  return response.json();
}

export async function createCategory(
  displayName: string,
  parentId?: number | null
): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName, parent_id: parentId }),
  });
  if (!response.ok) await throwApiError(response, "Failed to create category");
  return response.json();
}

export async function deleteCategory(id: number): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) await throwApiError(response, "Failed to delete category");
  return response.json();
}

export async function mergeCategories(
  sourceId: number,
  targetId: number
): Promise<{ ok: boolean; articles_moved: number }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
  });
  if (!response.ok) await throwApiError(response, "Failed to merge categories");
  return response.json();
}

export async function hideCategory(id: number): Promise<Category> {
  return updateCategory(id, { is_hidden: true });
}

export async function unhideCategory(id: number): Promise<Category> {
  return updateCategory(id, { is_hidden: false });
}

export async function fetchNewCategoryCount(): Promise<{ count: number }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/unseen-count`);
  if (!response.ok) await throwApiError(response, "Failed to fetch new category count");
  return response.json();
}

export async function acknowledgeCategories(categoryIds: number[]): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/mark-seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_ids: categoryIds }),
  });
  if (!response.ok) await throwApiError(response, "Failed to acknowledge categories");
  return response.json();
}

export async function fetchScoringStatus(): Promise<ScoringStatus> {
  const response = await fetch(`${API_BASE_URL}/api/scoring/status`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch scoring status");
  }

  return response.json();
}

// --- Provider API ---

export async function fetchProviders(): Promise<ProviderListItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/providers`);
  if (!response.ok) await throwApiError(response, "Failed to fetch providers");
  return response.json();
}

export async function disconnectProvider(
  provider: string
): Promise<{ ok: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/api/providers/${encodeURIComponent(provider)}`,
    { method: "DELETE" }
  );
  if (!response.ok) await throwApiError(response, "Failed to disconnect provider");
  return response.json();
}

export async function saveProviderConfig(
  provider: string,
  config: unknown
): Promise<OllamaConfig> {
  const response = await fetch(
    `${API_BASE_URL}/api/providers/${encodeURIComponent(provider)}/config`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }
  );
  if (!response.ok) await throwApiError(response, "Failed to save provider config");
  return response.json();
}

export async function fetchAvailableModels(): Promise<AvailableModel[]> {
  const response = await fetch(`${API_BASE_URL}/api/models`);
  if (!response.ok) await throwApiError(response, "Failed to fetch available models");
  return response.json();
}

export async function fetchTaskRoutes(): Promise<TaskRoutesResponse> {
  const response = await fetch(`${API_BASE_URL}/api/task-routes`);
  if (!response.ok) await throwApiError(response, "Failed to fetch task routes");
  return response.json();
}

export async function saveTaskRoutes(
  data: TaskRoutesUpdate
): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/task-routes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) await throwApiError(response, "Failed to save task routes");
  return response.json();
}

// --- Ollama Configuration API ---

export async function fetchOllamaHealth(): Promise<OllamaHealth> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/health`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch Ollama health");
  }

  return response.json();
}

export async function fetchOllamaModels(): Promise<OllamaModel[]> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/models`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch Ollama models");
  }

  return response.json();
}

export async function fetchOllamaConfig(): Promise<OllamaConfig> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/config`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch Ollama config");
  }

  return response.json();
}

export async function saveOllamaConfig(
  data: OllamaConfig
): Promise<OllamaConfig> {
  const response = await fetch(
    `${API_BASE_URL}/api/providers/ollama/config`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    await throwApiError(response, "Failed to save Ollama config");
  }

  return response.json();
}

export async function triggerRescore(): Promise<RescoreResult> {
  const response = await fetch(`${API_BASE_URL}/api/scoring`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to trigger rescore");
  }

  return response.json();
}

export async function fetchOllamaPrompts(): Promise<OllamaPrompts> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/prompts`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch Ollama prompts");
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
    await throwApiError(response, "Failed to delete Ollama model");
  }
}

export async function fetchDownloadStatus(): Promise<DownloadStatus> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/downloads`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch download status");
  }

  return response.json();
}

// --- Batch Category Operations ---

export async function batchMoveCategories(
  categoryIds: number[],
  targetParentId: number
): Promise<{ ok: boolean; updated: number }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/batch-move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_ids: categoryIds, target_parent_id: targetParentId }),
  });
  if (!response.ok) await throwApiError(response, "Failed to move categories");
  return response.json();
}

export async function batchHideCategories(
  categoryIds: number[]
): Promise<{ ok: boolean; updated: number }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/batch-hide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_ids: categoryIds }),
  });
  if (!response.ok) await throwApiError(response, "Failed to hide categories");
  return response.json();
}

export async function batchDeleteCategories(
  categoryIds: number[]
): Promise<{ ok: boolean; deleted: number }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/batch-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_ids: categoryIds }),
  });
  if (!response.ok) await throwApiError(response, "Failed to delete categories");
  return response.json();
}

export async function ungroupParent(
  categoryId: number
): Promise<{ ok: boolean; children_ungrouped: number }> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${categoryId}/ungroup`, {
    method: "POST",
  });
  if (!response.ok) await throwApiError(response, "Failed to ungroup category");
  return response.json();
}

export async function fetchRefreshStatus(): Promise<RefreshStatus> {
  const response = await fetch(`${API_BASE_URL}/api/feeds/refresh-status`);
  if (!response.ok) await throwApiError(response, "Failed to fetch refresh status");
  return response.json();
}
