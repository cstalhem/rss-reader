"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOllamaModels } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useOllamaModels(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.ollama.models,
    queryFn: fetchOllamaModels,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
