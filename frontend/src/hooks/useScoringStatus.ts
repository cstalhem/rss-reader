"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchScoringStatus } from "@/lib/api";

export function useScoringStatus() {
  return useQuery({
    queryKey: ["scoring-status"],
    queryFn: fetchScoringStatus,
    staleTime: 30000, // 30s to match article query staleTime
    refetchInterval: 30000, // Refresh every 30s to keep counts current
  });
}
