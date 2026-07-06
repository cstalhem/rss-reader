"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteCategory } from "@/lib/api";
import { invalidateCategoriesAndArticles } from "@/lib/invalidation";

/** Deleting a category releases its article links — invalidate articles alongside categories. */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSettled: () => {
      invalidateCategoriesAndArticles(queryClient);
    },
    meta: { errorTitle: "Failed to delete category" },
  });
}
