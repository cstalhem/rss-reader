"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchArticles, updateArticleReadStatus } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

const PAGE_SIZE = 50;
const SCORING_ACTIVE_POLL_INTERVAL = 10_000;
const SCORING_TAB_POLL_INTERVAL = 5_000;

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
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filters = {
    is_read: showAll ? undefined : false,
    limit,
    feed_id: feedId,
    sort_by: sortBy,
    order: order,
    scoring_state: scoringState,
    exclude_blocked: excludeBlocked,
  };

  const query = useQuery({
    queryKey: queryKeys.articles.list(filters),
    queryFn: () => fetchArticles(filters),
    refetchInterval: (query) => {
      // When scoring is active globally, poll for newly scored articles
      if (scoringActive) return SCORING_ACTIVE_POLL_INTERVAL;

      // For Scoring tab: poll while articles are actively being processed
      const articles = query.state.data;
      if (!articles) return false;
      const hasActiveScoring = articles.some(
        (a) => a.scoring_state === "queued" || a.scoring_state === "scoring"
      );
      return hasActiveScoring ? SCORING_TAB_POLL_INTERVAL : false;
    },
  });

  const loadMore = () => {
    setLimit((prev) => prev + PAGE_SIZE);
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
    meta: { errorTitle: "Failed to update article" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}
