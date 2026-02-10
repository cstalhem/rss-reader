"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchArticles, updateArticleReadStatus } from "@/lib/api";
import { Article } from "@/lib/types";

interface UseArticlesOptions {
  showAll?: boolean;
  feedId?: number;
}

export function useArticles(options: UseArticlesOptions = {}) {
  const { showAll = false, feedId } = options;
  const [limit, setLimit] = useState(50);

  const query = useQuery({
    queryKey: [
      "articles",
      { is_read: showAll ? undefined : false, limit, feed_id: feedId },
    ],
    queryFn: () =>
      fetchArticles({
        is_read: showAll ? undefined : false,
        limit,
        feed_id: feedId,
      }),
  });

  const loadMore = () => {
    setLimit((prev) => prev + 50);
  };

  const hasMore = query.data ? query.data.length === limit : false;

  return {
    ...query,
    loadMore,
    hasMore,
  };
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      articleId,
      isRead,
    }: {
      articleId: number;
      isRead: boolean;
    }) => updateArticleReadStatus(articleId, isRead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}
