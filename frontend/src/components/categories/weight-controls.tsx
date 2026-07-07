"use client";

import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_WEIGHT_ICON,
  CATEGORY_WEIGHT_LABEL,
  CATEGORY_WEIGHTS,
} from "@/lib/constants";
import type { CategoryWeight } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEIGHT_TONE: Record<CategoryWeight, string> = {
  block: "text-destructive",
  reduce: "text-muted-foreground",
  normal: "text-muted-foreground",
  boost: "text-primary",
  max: "text-primary font-medium",
};

/** Read-only current-weight pill — used in triage rows. */
export function WeightIndicator({ weight }: { weight: CategoryWeight }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded px-1.5 text-[11px] font-normal",
        WEIGHT_TONE[weight],
      )}
    >
      {CATEGORY_WEIGHT_LABEL[weight]}
    </Badge>
  );
}

/**
 * Segmented 5-value weight control (issue #98 decision: segmented won over the
 * select/stepper variants). Full word labels on ALL breakpoints, each paired
 * with a leading icon, and never wrapped onto a second line. `fullWidth`
 * stretches segments evenly to fill the row on mobile only — at md+ segments
 * always revert to their natural (possibly unequal) widths.
 */
export function WeightControl({
  value,
  onChange,
  disabled = false,
  fullWidth = false,
  className,
}: {
  value: CategoryWeight;
  onChange: (weight: CategoryWeight) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Weight"
      className={cn(
        "border-border overflow-hidden rounded-md border",
        fullWidth ? "flex w-full md:inline-flex md:w-auto" : "inline-flex",
        className,
      )}
    >
      {CATEGORY_WEIGHTS.map((weight) => {
        const active = weight === value;
        const Icon = CATEGORY_WEIGHT_ICON[weight];
        return (
          <button
            key={weight}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(weight)}
            className={cn(
              "border-border inline-flex min-w-0 items-center justify-center gap-1 border-r px-2 py-1.5 text-xs whitespace-nowrap transition-colors last:border-r-0 disabled:cursor-not-allowed disabled:opacity-50",
              fullWidth && "flex-1 md:flex-none",
              active
                ? weight === "block"
                  ? "bg-destructive text-white"
                  : "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {CATEGORY_WEIGHT_LABEL[weight]}
          </button>
        );
      })}
    </div>
  );
}
