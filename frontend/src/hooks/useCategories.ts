"use client";

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
import { toaster } from "@/components/ui/toaster";

export function useCategories() {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const newCountQuery = useQuery({
    queryKey: ["categories", "new-count"],
    queryFn: fetchNewCategoryCount,
    refetchInterval: 30000,
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<Category, "display_name" | "parent_id" | "weight" | "is_hidden" | "is_seen">> }) =>
      apiUpdateCategory(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["categories"] });
      const previous = queryClient.getQueryData<Category[]>(["categories"]);
      if (previous) {
        queryClient.setQueryData<Category[]>(["categories"], (old) =>
          (old ?? []).map((cat) => (cat.id === id ? { ...cat, ...data } : cat))
        );
      }
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["categories"], context.previous);
      }
      toaster.create({
        title: "Failed to update category",
        description: err.message,
        type: "error",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: ({ displayName, parentId }: { displayName: string; parentId?: number | null }) =>
      apiCreateCategory(displayName, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to create category",
        description: err.message,
        type: "error",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiDeleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to delete category",
        description: err.message,
        type: "error",
      });
    },
  });

  const hideMutation = useMutation({
    mutationFn: (id: number) => apiHideCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to hide category",
        description: err.message,
        type: "error",
      });
    },
  });

  const unhideMutation = useMutation({
    mutationFn: (id: number) => apiUnhideCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to unhide category",
        description: err.message,
        type: "error",
      });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (categoryIds: number[]) => apiAcknowledgeCategories(categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to acknowledge categories",
        description: err.message,
        type: "error",
      });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: number; targetId: number }) =>
      apiMergeCategories(sourceId, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to merge categories",
        description: err.message,
        type: "error",
      });
    },
  });

  const batchMoveMutation = useMutation({
    mutationFn: ({ categoryIds, targetParentId }: { categoryIds: number[]; targetParentId: number }) =>
      apiBatchMoveCategories(categoryIds, targetParentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to move categories",
        description: err.message,
        type: "error",
      });
    },
  });

  const batchHideMutation = useMutation({
    mutationFn: (categoryIds: number[]) => apiBatchHideCategories(categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to hide categories",
        description: err.message,
        type: "error",
      });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (categoryIds: number[]) => apiBatchDeleteCategories(categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to delete categories",
        description: err.message,
        type: "error",
      });
    },
  });

  const ungroupParentMutation = useMutation({
    mutationFn: (categoryId: number) => apiUngroupParent(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to ungroup category",
        description: err.message,
        type: "error",
      });
    },
  });

  return {
    categories: categoriesQuery.data ?? [],
    newCount: newCountQuery.data?.count ?? 0,
    isLoading: categoriesQuery.isLoading,
    updateCategory: (id: number, data: Partial<Pick<Category, "display_name" | "parent_id" | "weight" | "is_hidden" | "is_seen">>) => {
      // Auto-acknowledge when changing weight
      const payload = data.weight !== undefined ? { ...data, is_seen: true } : data;
      updateCategoryMutation.mutate({ id, data: payload });
    },
    createCategory: (displayName: string, parentId?: number | null) =>
      createCategoryMutation.mutate({ displayName, parentId }),
    deleteCategory: (id: number) => deleteCategoryMutation.mutate(id),
    hideCategory: (id: number) => hideMutation.mutate(id),
    unhideCategory: (id: number) => unhideMutation.mutate(id),
    acknowledge: (categoryIds: number[]) => acknowledgeMutation.mutate(categoryIds),
    mergeCategories: (sourceId: number, targetId: number) =>
      mergeMutation.mutate({ sourceId, targetId }),
    batchMove: (categoryIds: number[], targetParentId: number) =>
      batchMoveMutation.mutate({ categoryIds, targetParentId }),
    batchHide: (categoryIds: number[]) => batchHideMutation.mutate(categoryIds),
    batchDelete: (categoryIds: number[]) => batchDeleteMutation.mutate(categoryIds),
    ungroupParent: (categoryId: number) => ungroupParentMutation.mutate(categoryId),
    createCategoryMutation,
  };
}
