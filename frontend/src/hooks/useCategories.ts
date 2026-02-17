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
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) =>
      apiRenameCategory(name, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
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
