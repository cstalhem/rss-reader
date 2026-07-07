"use client";

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { updateArticleRead } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Article, ArticleListResponse } from "@/lib/types";

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) =>
      updateArticleRead(id, isRead),
    onSuccess: (updated, { id }) => {
      // Surgically flip is_read in every cached articles list page — rows dim
      // in place rather than vanish, which is the deliberate UX behavior.
      queryClient.setQueriesData<InfiniteData<ArticleListResponse>>(
        { queryKey: queryKeys.articles.all },
        (data) => {
          if (!data || !("pages" in data)) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id ? { ...item, is_read: updated.is_read } : item,
              ),
            })),
          };
        },
      );

      queryClient.setQueryData<Article>(
        queryKeys.articles.detail(id),
        (existing) =>
          existing ? { ...existing, is_read: updated.is_read } : existing,
      );

      // Badges are server-computed — invalidate rather than derive client-side.
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.counts });
    },
    meta: { errorTitle: "Failed to update article" },
  });
}
