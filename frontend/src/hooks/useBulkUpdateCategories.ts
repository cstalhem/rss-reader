"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkUpdateCategories } from "@/lib/api";
import {
  invalidateCategories,
  invalidateCategoriesAndArticles,
} from "@/lib/invalidation";
import type { CategoryBulkUpdatePayload } from "@/lib/types";

/** ADR-0010: a bulk weight change also mutates article `scoring_state` — invalidate articles/counts alongside categories when `weight` is part of the payload. */
export function useBulkUpdateCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryBulkUpdatePayload) =>
      bulkUpdateCategories(payload),
    onSettled: (_data, _error, payload) => {
      if (payload.weight !== undefined) {
        invalidateCategoriesAndArticles(queryClient);
      } else {
        invalidateCategories(queryClient);
      }
    },
    meta: { errorTitle: "Failed to update categories" },
  });
}
