"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPreferences,
  updatePreferences as apiUpdatePreferences,
} from "@/lib/api";
import { UserPreferences } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";

export function usePreferences() {
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences.all,
    queryFn: fetchPreferences,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: Partial<UserPreferences>) =>
      apiUpdatePreferences(data),
    meta: { errorTitle: "Failed to save preferences" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences.all });
    },
  });

  return {
    preferences: preferencesQuery.data,
    isLoading: preferencesQuery.isLoading,
    updatePreferencesMutation,
  };
}
