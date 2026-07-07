"use client";

import { Circle, CircleCheck } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { ReadFilter } from "@/lib/types";

interface ReadFilterToggleProps {
  value: ReadFilter;
  onChange: (value: ReadFilter) => void;
  className?: string;
}

// Segmented-control look: the group is a muted track, the active item is raised
// (bg-background + shadow) — buttons read as sitting IN a surface, not floating.
// h-11 for mobile thumb targets, h-8 on desktop so it fits the h-14 header.
const ITEM_CLASS =
  "h-11 gap-1.5 rounded-md px-3 text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm md:h-8";

/** Two-segment "Unread | Read" filter control styled as a segmented surface. Presentational only — the parent owns placement. */
export function ReadFilterToggle({
  value,
  onChange,
  className,
}: ReadFilterToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix fires "" on re-clicking the active item (deselect) — ignore it
        // so the filter can never become unset.
        if (next === "unread" || next === "read") {
          onChange(next);
        }
      }}
      aria-label="Filter articles by read state"
      className={cn("bg-muted gap-1 rounded-lg p-1", className)}
    >
      <ToggleGroupItem value="unread" className={ITEM_CLASS}>
        <Circle className="size-3.5" />
        Unread
      </ToggleGroupItem>
      <ToggleGroupItem value="read" className={ITEM_CLASS}>
        <CircleCheck className="size-3.5" />
        Read
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
