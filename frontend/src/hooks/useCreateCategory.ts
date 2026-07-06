"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCategory } from "@/lib/api";
import { invalidateCategories } from "@/lib/invalidation";
import type { CategoryCreatePayload } from "@/lib/types";

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryCreatePayload) => createCategory(payload),
    onSettled: () => {
      invalidateCategories(queryClient);
    },
    meta: { errorTitle: "Failed to create category" },
  });
}
