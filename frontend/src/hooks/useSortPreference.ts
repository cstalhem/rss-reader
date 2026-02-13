"use client";

import { useLocalStorage } from "./useLocalStorage";
import { SortOption } from "@/lib/types";

export function useSortPreference() {
  const [sortOption, setSortOption] = useLocalStorage<SortOption>(
    "rss-sort-preference",
    "score_desc"
  );
  return { sortOption, setSortOption };
}
