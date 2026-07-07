"use client";

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { rateArticle } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Article, ArticleListResponse } from "@/lib/types";

export function useRateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, value }: { id: number; value: 1 | -1 | null }) =>
      rateArticle(id, value),
    onSuccess: (updated, { id }) => {
      // Rating is inert in v2 — it changes no counts, ordering, or filtering.
      // Surgically patch the rating into every cached list page and the detail
      // cache; deliberately do NOT invalidate feeds/folders/counts.
      queryClient.setQueriesData<InfiniteData<ArticleListResponse>>(
        { queryKey: queryKeys.articles.all },
        (data) => {
          if (!data || !("pages" in data)) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id ? { ...item, rating: updated.rating } : item,
              ),
            })),
          };
        },
      );

      queryClient.setQueryData<Article>(
        queryKeys.articles.detail(id),
        (existing) =>
          existing ? { ...existing, rating: updated.rating } : existing,
      );
    },
    meta: { errorTitle: "Failed to rate article" },
  });
}
