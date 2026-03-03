"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAvailableModels } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useAvailableModels() {
  const query = useQuery({
    queryKey: queryKeys.models.available,
    queryFn: fetchAvailableModels,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    models: query.data,
    isLoading: query.isLoading,
  };
}
