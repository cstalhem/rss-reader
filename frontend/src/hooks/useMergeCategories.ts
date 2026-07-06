"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mergeCategories } from "@/lib/api";
import { invalidateCategoriesAndArticles } from "@/lib/invalidation";
import type { CategoryMergePayload } from "@/lib/types";

/** Merge moves article links from source to target — invalidate articles alongside categories. */
export function useMergeCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryMergePayload) => mergeCategories(payload),
    onSettled: () => {
      invalidateCategoriesAndArticles(queryClient);
    },
    meta: { errorTitle: "Failed to merge categories" },
  });
}
