import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ScoringStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pending = the three non-terminal scoring_state counts. Deliberately INCLUDES re-scoring articles (which have an old composite_score), so it diverges from the backend's scoring_pending_condition() which excludes them — editing interests re-queues scored articles and the chip must reflect that drain.
export function scoringPendingCount(status: ScoringStatus | undefined): number {
  return (
    (status?.unscored ?? 0) + (status?.queued ?? 0) + (status?.scoring ?? 0)
  );
}

/**
 * Backend datetimes are naive UTC serialized WITHOUT a zone suffix
 * (e.g. "2026-07-05T21:42:49.090779"). `new Date()` parses offset-less
 * date-time strings as LOCAL time, so append "Z" to force UTC.
 */
export function parseServerDate(iso: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
}

/** "3m" / "5h" / "2d" — compact relative age for `feed · age` meta lines. Empty for null/invalid. */
export function formatAge(iso: string | null): string {
  if (!iso) return "";
  const time = parseServerDate(iso).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
