"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPreferences,
  updatePreferences as apiUpdatePreferences,
} from "@/lib/api";
import { UserPreferences } from "@/lib/types";

export function usePreferences() {
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: Partial<UserPreferences>) =>
      apiUpdatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });

  return {
    preferences: preferencesQuery.data,
    isLoading: preferencesQuery.isLoading,
    updatePreferences: updatePreferencesMutation.mutate,
    isUpdating: updatePreferencesMutation.isPending,
  };
}
