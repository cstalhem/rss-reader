"use client";

import { Badge, MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@chakra-ui/react";
import { LuCheck } from "react-icons/lu";

interface TagChipProps {
  label: string;
  size?: "sm" | "md";
  interactive?: boolean;
  currentWeight?: string;
  onWeightChange?: (weight: string) => void;
}

const weightColors = {
  blocked: { bg: "red.subtle", color: "red.fg", textDecoration: "line-through" },
  low: { bg: "bg.emphasized", color: "fg.muted" },
  neutral: { bg: "bg.emphasized", color: "fg.default" },
  medium: { bg: "accent.subtle", color: "accent.fg" },
  high: { bg: "accent.emphasized", color: "accent.contrast" },
};

const weightOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "neutral", label: "Neutral" },
  { value: "low", label: "Low" },
  { value: "blocked", label: "Blocked" },
];

export function TagChip({
  label,
  size = "sm",
  interactive = false,
  currentWeight = "neutral",
  onWeightChange,
}: TagChipProps) {
  const fontSize = size === "sm" ? "xs" : "sm";
  const normalizedWeight = currentWeight?.toLowerCase() || "neutral";
  const colorProps = weightColors[normalizedWeight as keyof typeof weightColors] || weightColors.neutral;

  const chip = (
    <Badge
      fontSize={fontSize}
      px={2}
      py={0.5}
      borderRadius="md"
      fontWeight="medium"
      textTransform="lowercase"
      {...colorProps}
      cursor={interactive ? "pointer" : "default"}
      _hover={interactive ? { opacity: 0.8 } : undefined}
    >
      {label}
    </Badge>
  );

  if (!interactive) {
    return chip;
  }

  return (
    <MenuRoot>
      <MenuTrigger
        asChild
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
        }}
      >
        {chip}
      </MenuTrigger>
      <MenuContent>
        {weightOptions.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            onClick={(e) => {
              e.stopPropagation();
              onWeightChange?.(option.value);
            }}
          >
            {option.label}
            {normalizedWeight === option.value && (
              <LuCheck style={{ marginLeft: "auto" }} />
            )}
          </MenuItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}
