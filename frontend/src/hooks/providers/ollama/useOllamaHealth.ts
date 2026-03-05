"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOllamaHealth } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

const HEALTH_POLL_INTERVAL = 20_000;

export function useOllamaHealth(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.ollama.health,
    queryFn: fetchOllamaHealth,
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? HEALTH_POLL_INTERVAL : false,
  });
}
