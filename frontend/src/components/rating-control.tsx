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
      value={ratingToValue(rating)}
      onValueChange={(value) =>
        rate.mutate({ id: articleId, value: valueToRating(value) })
      }
      className={className}
    >
      <ToggleGroupItem value="up" aria-label="Thumbs up">
        <ThumbsUp />
      </ToggleGroupItem>
      <ToggleGroupItem value="down" aria-label="Thumbs down">
        <ThumbsDown />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
