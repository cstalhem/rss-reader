"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFeeds } from "@/lib/api";
import { FEED_STATE_POLL_INTERVAL } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";

export function useFeeds() {
  return useQuery({
    queryKey: queryKeys.feeds.all,
    queryFn: fetchFeeds,
    refetchInterval: FEED_STATE_POLL_INTERVAL,
  });
}
