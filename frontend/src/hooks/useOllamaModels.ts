"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOllamaModels } from "@/lib/api";

export function useOllamaModels(enabled: boolean = true) {
  return useQuery({
    queryKey: ["ollama-models"],
    queryFn: fetchOllamaModels,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
