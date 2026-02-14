"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchScoringStatus } from "@/lib/api";

export function useScoringStatus() {
  const query = useQuery({
    queryKey: ["scoring-status"],
    queryFn: fetchScoringStatus,
    staleTime: 5000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 30000;
      // Poll faster when articles are actively being scored
      const activeCount = (data.unscored ?? 0) + (data.queued ?? 0) + (data.scoring ?? 0);
      return activeCount > 0 ? 5000 : 30000;
    },
  });

  return query;
}
