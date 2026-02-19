"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchScoringStatus } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

const SCORING_STATUS_ACTIVE_INTERVAL = 2_500;
const SCORING_STATUS_IDLE_INTERVAL = 30_000;

export function useScoringStatus() {
  const query = useQuery({
    queryKey: queryKeys.scoringStatus.all,
    queryFn: fetchScoringStatus,
    staleTime: 5000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return SCORING_STATUS_IDLE_INTERVAL;
      // Poll faster when articles are actively being scored
      const activeCount = (data.unscored ?? 0) + (data.queued ?? 0) + (data.scoring ?? 0);
      return activeCount > 0 ? SCORING_STATUS_ACTIVE_INTERVAL : SCORING_STATUS_IDLE_INTERVAL;
    },
  });

  return query;
}
