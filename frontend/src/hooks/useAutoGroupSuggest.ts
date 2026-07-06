"use client";

import { useMutation } from "@tanstack/react-query";
import { autoGroupSuggest } from "@/lib/api";

/** POST endpoint that computes suggestions without persisting anything — no cache invalidation needed. */
export function useAutoGroupSuggest() {
  return useMutation({
    mutationFn: autoGroupSuggest,
    meta: { errorTitle: "Failed to suggest category groups" },
  });
}
