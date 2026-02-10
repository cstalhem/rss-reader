"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFeeds } from "@/lib/api";

export function useFeeds() {
  return useQuery({
    queryKey: ["feeds"],
    queryFn: fetchFeeds,
  });
}
