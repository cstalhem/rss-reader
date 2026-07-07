"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ReadFilter } from "@/lib/types";

interface ReadFilterToggleProps {
  value: ReadFilter;
  onChange: (value: ReadFilter) => void;
  className?: string;
}

/** Two-segment "Unread | Read" filter control. Presentational only — the parent owns placement. */
export function ReadFilterToggle({
  value,
  onChange,
  className,
}: ReadFilterToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(next) => {
        // Radix fires "" on re-clicking the active item (deselect) — ignore it
        // so the filter can never become unset.
        if (next === "unread" || next === "read") {
          onChange(next);
        }
      }}
      aria-label="Filter articles by read state"
      className={className}
    >
      <ToggleGroupItem value="unread" className="h-11 px-4">
        Unread
      </ToggleGroupItem>
      <ToggleGroupItem value="read" className="h-11 px-4">
        Read
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
