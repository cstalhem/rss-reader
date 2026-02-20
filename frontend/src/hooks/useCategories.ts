"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCategories,
  fetchNewCategoryCount,
  updateCategory as apiUpdateCategory,
  createCategory as apiCreateCategory,
  deleteCategory as apiDeleteCategory,
  hideCategory as apiHideCategory,
  unhideCategory as apiUnhideCategory,
  acknowledgeCategories as apiAcknowledgeCategories,
  mergeCategories as apiMergeCategories,
  batchMoveCategories as apiBatchMoveCategories,
  batchHideCategories as apiBatchHideCategories,
  batchDeleteCategories as apiBatchDeleteCategories,
  ungroupParent as apiUngroupParent,
} from "@/lib/api";
import { Category } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { NEW_COUNT_POLL_INTERVAL } from "@/lib/constants";
import { toaster } from "@/components/ui/toaster";

export function useCategories() {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: fetchCategories,
  });

  const newCountQuery = useQuery({
    queryKey: queryKeys.categories.newCount,
    queryFn: fetchNewCategoryCount,
    refetchInterval: NEW_COUNT_POLL_INTERVAL,
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<Category, "display_name" | "parent_id" | "weight" | "is_hidden" | "is_seen">> }) =>
      apiUpdateCategory(id, data),
    meta: { handlesOwnErrors: true },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.all });
      const previous = queryClient.getQueryData<Category[]>(queryKeys.categories.all);
      if (previous) {
        queryClient.setQueryData<Category[]>(queryKeys.categories.all, (old) =>
          (old ?? []).map((cat) => (cat.id === id ? { ...cat, ...data } : cat))
        );
      }
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories.all, context.previous);
      }
      toaster.create({
        title: "Failed to update category",
        description: err.message,
        type: "error",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: ({ displayName, parentId }: { displayName: string; parentId?: number | null }) =>
      apiCreateCategory(displayName, parentId),
    meta: { errorTitle: "Failed to create category" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiDeleteCategory(id),
    meta: { errorTitle: "Failed to delete category" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });

  const hideMutation = useMutation({
    mutationFn: (id: number) => apiHideCategory(id),
    meta: { errorTitle: "Failed to hide category" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });

  const unhideMutation = useMutation({
    mutationFn: (id: number) => apiUnhideCategory(id),
    meta: { errorTitle: "Failed to unhide category" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (categoryIds: number[]) => apiAcknowledgeCategories(categoryIds),
    meta: { errorTitle: "Failed to acknowledge categories" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: number; targetId: number }) =>
      apiMergeCategories(sourceId, targetId),
    meta: { errorTitle: "Failed to merge categories" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });

  const batchMoveMutation = useMutation({
    mutationFn: ({ categoryIds, targetParentId }: { categoryIds: number[]; targetParentId: number }) =>
      apiBatchMoveCategories(categoryIds, targetParentId),
    meta: { errorTitle: "Failed to move categories" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });

  const batchHideMutation = useMutation({
    mutationFn: (categoryIds: number[]) => apiBatchHideCategories(categoryIds),
    meta: { errorTitle: "Failed to hide categories" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (categoryIds: number[]) => apiBatchDeleteCategories(categoryIds),
    meta: { errorTitle: "Failed to delete categories" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });

  const ungroupParentMutation = useMutation({
    mutationFn: (categoryId: number) => apiUngroupParent(categoryId),
    meta: { errorTitle: "Failed to ungroup category" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });

  // Stable helper with auto-acknowledge logic — useCallback ensures consumers
  // get a referentially stable function (critical for React.memo on row components)
  const updateCategory = useCallback(
    (id: number, data: Partial<Pick<Category, "display_name" | "parent_id" | "weight" | "is_hidden" | "is_seen">>) => {
      const payload = data.weight !== undefined ? { ...data, is_seen: true } : data;
      updateCategoryMutation.mutate({ id, data: payload });
    },
    [updateCategoryMutation.mutate]
  );

  return {
    categories: categoriesQuery.data ?? [],
    newCount: newCountQuery.data?.count ?? 0,
    isLoading: categoriesQuery.isLoading,
    updateCategory,
    updateCategoryMutation,
    createCategoryMutation,
    deleteCategoryMutation,
    hideMutation,
    unhideMutation,
    acknowledgeMutation,
    mergeMutation,
    batchMoveMutation,
    batchHideMutation,
    batchDeleteMutation,
    ungroupParentMutation,
  };
}
