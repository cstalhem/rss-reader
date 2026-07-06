import { Badge } from "@/components/ui/badge";

/**
 * Count badge for a settings nav entry (currently only Categories, for
 * triage-needed count). Pure prop-in seam — no data fetching here.
 *
 * TODO(#98 phase 4): pass the real triage count from useCategories into the
 * Categories nav entry via `SettingsShell`'s `badgeCounts` prop, keyed by
 * section id. Until then no caller supplies a count and this never renders.
 */
export function SettingsNavBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <Badge variant="default" className="rounded-full px-1.5">
      {count}
    </Badge>
  );
}
