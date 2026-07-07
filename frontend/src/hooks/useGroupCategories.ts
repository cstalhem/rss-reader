"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { groupCategories } from "@/lib/api";
import { invalidateCategories } from "@/lib/invalidation";
import type { CategoryGroupPayload } from "@/lib/types";

/** Grouping is display-only (ADR-0001/0009) — zero article side-effects, categories only. */
export function useGroupCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryGroupPayload) => groupCategories(payload),
    onSettled: () => {
      invalidateCategories(queryClient);
    },
    meta: { errorTitle: "Failed to group categories" },
  });
}
