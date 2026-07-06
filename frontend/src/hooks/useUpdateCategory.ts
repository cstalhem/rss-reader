"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, updateCategory } from "@/lib/api";
import {
  invalidateCategories,
  invalidateCategoriesAndArticles,
} from "@/lib/invalidation";
import { queryKeys } from "@/lib/queryKeys";
import type { Category, CategoryUpdatePayload } from "@/lib/types";

/**
 * Optimistically applies the patch to every cached category list so weight/
 * triage toggles feel instant, then rolls back on error (ADR-0010: weight
 * changes also mutate article `scoring_state`, so a successful settle
 * invalidates articles/counts too, not just categories).
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryUpdatePayload }) =>
      updateCategory(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.all });

      const previous = queryClient.getQueriesData<Category[]>({
        queryKey: queryKeys.categories.all,
      });

      queryClient.setQueriesData<Category[]>(
        { queryKey: queryKeys.categories.all },
        (categories) =>
          categories?.map((category) =>
            category.id === id ? { ...category, ...data } : category,
          ),
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      // A 409 only occurs on rename-to-existing-name; RenameModal catches it
      // and shows an inline "merge instead?" affordance, so skip the generic
      // toast here to avoid showing both.
      if (error instanceof ApiError && error.status === 409) return;
      toast.error("Failed to update category", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    },
    onSettled: (_data, _error, { data }) => {
      if (data.weight !== undefined) {
        invalidateCategoriesAndArticles(queryClient);
      } else {
        invalidateCategories(queryClient);
      }
    },
    meta: { handlesOwnErrors: true },
  });
}
