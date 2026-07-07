"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchArticleCounts } from "@/lib/api";
import { FEED_STATE_POLL_INTERVAL } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";

export function useArticleCounts() {
  return useQuery({
    queryKey: queryKeys.articles.counts,
    queryFn: fetchArticleCounts,
    refetchInterval: FEED_STATE_POLL_INTERVAL,
  });
}
