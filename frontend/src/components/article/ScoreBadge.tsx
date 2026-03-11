"use client";

import { Badge, Flex, Spinner } from "@chakra-ui/react";
import { HIGH_SCORE_THRESHOLD } from "@/lib/constants";

interface ScoreBadgeProps {
  score: number | null;
  scoringState: string;
  reEvaluating?: boolean;
  size?: "sm" | "md";
}

export function ScoreBadge({ score, scoringState, reEvaluating, size = "sm" }: ScoreBadgeProps) {
  if (score === null) return null;
  if (scoringState !== "scored" && !reEvaluating) return null;

  // Determine badge appearance based on score
  const scoreDisplay = score.toFixed(1);

  let colorPalette: string;
  let variant: "solid" | "subtle" | "outline";

  if (score >= HIGH_SCORE_THRESHOLD) {
    colorPalette = "accent";
    variant = "solid";
  } else if (score >= 8) {
    colorPalette = "gray";
    variant = "subtle";
  } else {
    colorPalette = "gray";
    variant = "outline";
  }

  const fontSize = size === "sm" ? "xs" : "sm";

  const badgeProps = {
    "aria-label": `Score: ${scoreDisplay}`,
    colorPalette,
    variant,
    fontSize,
    px: 2,
    py: 0.5,
    borderRadius: "md" as const,
    fontWeight: "semibold" as const,
  };

  if (reEvaluating) {
    return (
      <Flex alignItems="center" gap={1}>
        <Badge opacity={0.5} {...badgeProps}>
          {scoreDisplay}
        </Badge>
        <Spinner size="xs" colorPalette="accent" />
      </Flex>
    );
  }

  return (
    <Badge {...badgeProps}>
      {scoreDisplay}
    </Badge>
  );
}
