"use client";

import { useScoringStatus } from "@/hooks/useScoringStatus";
import { scoringPendingCount } from "@/lib/utils";

/**
 * Quiet-when-idle status row for the sidebar footer — shows how many articles
 * are still queued/scoring, or renders nothing. Non-interactive (no
 * link/button): there's no navigation target for scoring progress yet.
 */
export function ScoringStatusChip() {
  const { data } = useScoringStatus();
  const pending = scoringPendingCount(data);

  if (pending <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="text-muted-foreground mb-2 flex items-center gap-2 px-2 text-xs"
    >
      <span aria-hidden>
        Processing <span className="tabular-nums">{pending}</span>{" "}
        {pending === 1 ? "article" : "articles"}
      </span>
      <span
        aria-hidden
        className="bg-primary ml-auto size-1.5 shrink-0 animate-pulse rounded-full"
      />
      <span className="sr-only">{pending} articles left to process</span>
    </div>
  );
}
