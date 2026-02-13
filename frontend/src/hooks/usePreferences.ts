"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPreferences,
  updatePreferences as apiUpdatePreferences,
  fetchCategories,
  updateCategoryWeight as apiUpdateCategoryWeight,
} from "@/lib/api";
import { UserPreferences } from "@/lib/types";

export function usePreferences() {
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: Partial<UserPreferences>) =>
      apiUpdatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });

  const updateCategoryWeightMutation = useMutation({
    mutationFn: ({ category, weight }: { category: string; weight: string }) =>
      apiUpdateCategoryWeight(category, weight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  return {
    preferences: preferencesQuery.data,
    categories: categoriesQuery.data || [],
    isLoading: preferencesQuery.isLoading || categoriesQuery.isLoading,
    updatePreferences: updatePreferencesMutation.mutate,
    updateCategoryWeight: updateCategoryWeightMutation.mutate,
    isUpdating: updatePreferencesMutation.isPending,
  };
}
