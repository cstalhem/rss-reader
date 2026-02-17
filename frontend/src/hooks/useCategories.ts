"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCategoryGroups,
  saveCategoryGroups,
  fetchCategories,
  fetchNewCategoryCount,
  hideCategory as apiHideCategory,
  unhideCategory as apiUnhideCategory,
  acknowledgeCategories as apiAcknowledgeCategories,
  createCategory as apiCreateCategory,
  deleteCategory as apiDeleteCategory,
  renameCategory as apiRenameCategory,
} from "@/lib/api";
import { toaster } from "@/components/ui/toaster";

export function useCategories() {
  const queryClient = useQueryClient();

  const groupsQuery = useQuery({
    queryKey: ["categoryGroups"],
    queryFn: fetchCategoryGroups,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const newCountQuery = useQuery({
    queryKey: ["categories", "new-count"],
    queryFn: fetchNewCategoryCount,
    refetchInterval: 30000,
  });

  const saveGroupsMutation = useMutation({
    mutationFn: saveCategoryGroups,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });

  const hideMutation = useMutation({
    mutationFn: apiHideCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });

  const unhideMutation = useMutation({
    mutationFn: apiUnhideCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: apiAcknowledgeCategories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: apiCreateCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      toaster.create({
        title: "Category created",
        type: "success",
      });
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
    mutationFn: apiDeleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "new-count"] });
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to delete category",
        description: err.message,
        type: "error",
      });
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) =>
      apiRenameCategory(name, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
    onError: (err: Error) => {
      toaster.create({
        title: "Failed to rename category",
        description: err.message,
        type: "error",
      });
    },
  });

  return {
    categoryGroups: groupsQuery.data,
    allCategories: categoriesQuery.data || [],
    newCount: newCountQuery.data?.count ?? 0,
    returnedCount: newCountQuery.data?.returned_count ?? 0,
    isLoading: groupsQuery.isLoading || categoriesQuery.isLoading,
    saveGroups: saveGroupsMutation.mutate,
    hideCategory: hideMutation.mutate,
    unhideCategory: unhideMutation.mutate,
    acknowledge: acknowledgeMutation.mutate,
    createCategory: createCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
    renameCategory: renameCategoryMutation.mutate,
    isSaving: saveGroupsMutation.isPending,
  };
}
