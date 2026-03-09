"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { saveProviderConfig } from "@/lib/api";
import { fetchGoogleConfig } from "@/lib/providers/google";
import type { GoogleConfig } from "@/lib/types";
import { queryKeys, invalidateModelDependents } from "@/lib/queryKeys";

export function useGoogleConfig() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.google.config,
    queryFn: fetchGoogleConfig,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { api_key?: string; selected_models?: string[] }) =>
      saveProviderConfig("google", data),
    meta: { errorTitle: "Failed to save Google config" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.google.config });
      queryClient.invalidateQueries({
        queryKey: queryKeys.google.availableModels,
      });
      invalidateModelDependents(queryClient);
    },
  });

  return {
    config: query.data as GoogleConfig | undefined,
    isLoading: query.isLoading,
    saveMutation,
  };
}
