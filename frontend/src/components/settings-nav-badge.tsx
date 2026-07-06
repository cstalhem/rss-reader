/**
 * Count badge for a settings nav entry (currently only Categories, for
 * triage-needed count). Pure prop-in seam — no data fetching here.
 *
 * `SettingsShell` wires `useCategoryUnseenCount` into this via its
 * `badgeCounts` prop, keyed by section id; `CategoriesSection`'s Triage tab
 * also passes the same live count directly.
 *
 * Rendered as a plain `<span>` rather than the shadcn `Badge` — `Badge`'s
 * base padding/gap fight the fixed-height circle sizing needed to center a
 * single digit.
 */
export function SettingsNavBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs leading-none tabular-nums">
      {count}
    </span>
  );
}
