"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFeedFolders } from "@/lib/api";
import { FEED_STATE_POLL_INTERVAL } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";

export function useFeedFolders() {
  return useQuery({
    queryKey: queryKeys.feedFolders.all,
    queryFn: fetchFeedFolders,
    refetchInterval: FEED_STATE_POLL_INTERVAL,
  });
}
