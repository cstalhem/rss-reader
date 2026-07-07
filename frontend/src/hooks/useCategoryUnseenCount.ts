"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCategoryUnseenCount } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

/** Nav badge — count of categories awaiting triage. */
export function useCategoryUnseenCount() {
  return useQuery({
    queryKey: queryKeys.categories.triageCount,
    queryFn: fetchCategoryUnseenCount,
  });
}
