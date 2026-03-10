"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGoogleAvailableModels } from "@/lib/providers/google";
import { queryKeys } from "@/lib/queryKeys";

export function useGoogleModels(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.google.availableModels,
    queryFn: fetchGoogleAvailableModels,
    enabled,
    staleTime: 120_000,
  });

  return {
    models: query.data,
    isLoading: query.isLoading,
  };
}
