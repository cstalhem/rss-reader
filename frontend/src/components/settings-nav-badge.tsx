import { Badge } from "@/components/ui/badge";

/**
 * Count badge for a settings nav entry (currently only Categories, for
 * triage-needed count). Pure prop-in seam — no data fetching here.
 *
 * `SettingsShell` wires `useCategoryUnseenCount` into this via its
 * `badgeCounts` prop, keyed by section id; `CategoriesSection`'s Triage tab
 * also passes the same live count directly.
 */
export function SettingsNavBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <Badge variant="default" className="rounded-full px-1.5">
      {count}
    </Badge>
  );
}
