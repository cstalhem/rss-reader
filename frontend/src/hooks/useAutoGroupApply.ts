"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { autoGroupApply } from "@/lib/api";
import { invalidateCategories } from "@/lib/invalidation";
import type { AutoGroupApplyPayload } from "@/lib/types";

/** Applying auto-group suggestions is display-only grouping — categories only, no article side-effects. */
export function useAutoGroupApply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AutoGroupApplyPayload) => autoGroupApply(payload),
    onSettled: () => {
      invalidateCategories(queryClient);
    },
    meta: { errorTitle: "Failed to apply category groups" },
  });
}
