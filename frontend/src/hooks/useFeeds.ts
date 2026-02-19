"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFeeds } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useFeeds() {
  return useQuery({
    queryKey: queryKeys.feeds.all,
    queryFn: fetchFeeds,
  });
}
