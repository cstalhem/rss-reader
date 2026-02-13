"use client";

import { Badge, Tooltip } from "@chakra-ui/react";

interface ScoreBadgeProps {
  score: number | null;
  scoringState: string;
  size?: "sm" | "md";
}

export function ScoreBadge({ score, scoringState, size = "sm" }: ScoreBadgeProps) {
  // Only show badge for scored articles with a score
  if (scoringState !== "scored" || score === null) {
    return null;
  }

  // Determine badge appearance based on score
  const scoreDisplay = score.toFixed(1);

  let colorPalette: string;
  let variant: "solid" | "subtle" | "outline";

  if (score >= 15) {
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

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Badge
          colorPalette={colorPalette}
          variant={variant}
          fontSize={fontSize}
          px={2}
          py={0.5}
          borderRadius="md"
          fontWeight="semibold"
        >
          {scoreDisplay}
        </Badge>
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content>Score: {scoreDisplay}</Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}
