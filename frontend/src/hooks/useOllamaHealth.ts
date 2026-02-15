"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOllamaHealth } from "@/lib/api";

export function useOllamaHealth(enabled: boolean = true) {
  return useQuery({
    queryKey: ["ollama-health"],
    queryFn: fetchOllamaHealth,
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 20_000 : false,
  });
}
