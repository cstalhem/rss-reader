"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchScoringStatus } from "@/lib/api";
import {
  SCORING_STATUS_POLL_ACTIVE,
  SCORING_STATUS_POLL_IDLE,
} from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { scoringPendingCount } from "@/lib/utils";

export function useScoringStatus() {
  return useQuery({
    queryKey: queryKeys.scoring.status,
    queryFn: fetchScoringStatus,
    refetchInterval: (query) =>
      scoringPendingCount(query.state.data) > 0
        ? SCORING_STATUS_POLL_ACTIVE
        : SCORING_STATUS_POLL_IDLE,
  });
}
