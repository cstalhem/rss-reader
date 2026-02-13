"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchArticles, updateArticleReadStatus } from "@/lib/api";
import { Article } from "@/lib/types";

interface UseArticlesOptions {
  showAll?: boolean;
  feedId?: number;
  sortBy?: string;
  order?: string;
  scoringState?: string;
  excludeBlocked?: boolean;
  scoringActive?: boolean;
}

export function useArticles(options: UseArticlesOptions = {}) {
  const { showAll = false, feedId, sortBy, order, scoringState, excludeBlocked = true, scoringActive = false } = options;
  const [limit, setLimit] = useState(50);

  const query = useQuery({
    queryKey: [
      "articles",
      {
        is_read: showAll ? undefined : false,
        limit,
        feed_id: feedId,
        sort_by: sortBy,
        order: order,
        scoring_state: scoringState,
        exclude_blocked: excludeBlocked,
      },
    ],
    queryFn: () =>
      fetchArticles({
        is_read: showAll ? undefined : false,
        limit,
        feed_id: feedId,
        sort_by: sortBy,
        order: order,
        scoring_state: scoringState,
        exclude_blocked: excludeBlocked,
      }),
    refetchInterval: (query) => {
      // When scoring is active globally, poll for newly scored articles
      // (main views filter to scored-only, so they need external polling)
      if (scoringActive) return 10000;

      // For Scoring tab: poll while articles are actively being processed
      const articles = query.state.data;
      if (!articles) return false;
      const hasActiveScoring = articles.some(
        (a) => a.scoring_state === "queued" || a.scoring_state === "scoring"
      );
      return hasActiveScoring ? 5000 : false;
    },
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
