"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRateArticle } from "@/hooks/useRateArticle";

/** Maps the article's `rating` projection to the ToggleGroup's string value. */
function ratingToValue(rating: number | null): "up" | "down" | "" {
  if (rating === 1) return "up";
  if (rating === -1) return "down";
  return "";
}

/** Maps a ToggleGroup value back to the rating sent to the API. `""` (tap-active-to-clear) → `null`. */
function valueToRating(value: string): 1 | -1 | null {
  if (value === "up") return 1;
  if (value === "down") return -1;
  return null;
}

/**
 * Selected styling for both thumbs — the primary color on the icon and the
 * outline, with no background fill (overriding the base
 * `data-[state=on]:bg-accent`). The `data-[state=on]:hover:` variants pin the
 * look so an active thumb doesn't revert to the outline hover state, and the
 * matching `data-[state=on]:` prefix lets tailwind-merge dedupe the base away.
 */
const SELECTED =
  "data-[state=on]:bg-transparent data-[state=on]:text-primary data-[state=on]:border-primary data-[state=on]:hover:bg-transparent data-[state=on]:hover:text-primary";

interface RatingControlProps {
  articleId: number;
  /** The article's current rating projection (`1` / `-1` / `null`). */
  rating: number | null;
  className?: string;
}

/**
 * Two-item thumbs toggle. `type="single"` deselecting the active item to `""`
 * is the clear gesture (tap-active-to-clear). Rating is inert — the mutation
 * only patches caches, it invalidates nothing.
 */
export function RatingControl({
  articleId,
  rating,
  className,
}: RatingControlProps) {
  const rate = useRateArticle();

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      // Gap the two thumbs so each keeps its own full border — at the default
      // spacing=0 the segmented group collapses the shared edge (`border-l-0`
      // on the right item), leaving a selected right thumb with no left border
      // to draw in the primary color.
      spacing={1}
      value={ratingToValue(rating)}
      onValueChange={(value) =>
        rate.mutate({ id: articleId, value: valueToRating(value) })
      }
      className={className}
    >
      <ToggleGroupItem
        value="down"
        aria-label="Thumbs down"
        className={SELECTED}
      >
        <ThumbsDown />
      </ToggleGroupItem>
      <ToggleGroupItem value="up" aria-label="Thumbs up" className={SELECTED}>
        <ThumbsUp />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
