"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchGoogleAvailableModels,
  updateGoogleSelectedModels,
} from "@/lib/providers/google";
import { queryKeys, invalidateModelDependents } from "@/lib/queryKeys";

export function useGoogleModels(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.google.availableModels,
    queryFn: fetchGoogleAvailableModels,
    enabled,
    staleTime: 120_000,
  });

  const selectMutation = useMutation({
    mutationFn: updateGoogleSelectedModels,
    meta: { errorTitle: "Failed to update selected models" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.google.config });
      queryClient.invalidateQueries({
        queryKey: queryKeys.google.availableModels,
      });
      invalidateModelDependents(queryClient);
    },
  });

  return {
    models: query.data,
    isLoading: query.isLoading,
    selectMutation,
  };
}
