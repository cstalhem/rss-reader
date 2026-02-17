"use client";

import { Badge, Menu, Portal } from "@chakra-ui/react";

interface TagChipProps {
  label: string;
  size?: "sm" | "md";
  interactive?: boolean;
  currentWeight?: string;
  onWeightChange?: (weight: string) => void;
}

const weightColors: Record<string, { bg: string; color: string; textDecoration?: string }> = {
  block: { bg: "red.subtle", color: "red.fg", textDecoration: "line-through" },
  reduce: { bg: "bg.emphasized", color: "fg.muted" },
  normal: { bg: "bg.emphasized", color: "fg.default" },
  boost: { bg: "accent.subtle", color: "accent.fg" },
  max: { bg: "accent.emphasized", color: "accent.contrast" },
  // Old names as aliases
  blocked: { bg: "red.subtle", color: "red.fg", textDecoration: "line-through" },
  low: { bg: "bg.emphasized", color: "fg.muted" },
  neutral: { bg: "bg.emphasized", color: "fg.default" },
  medium: { bg: "accent.subtle", color: "accent.fg" },
  high: { bg: "accent.emphasized", color: "accent.contrast" },
};

const weightOptions = [
  { value: "max", label: "Max" },
  { value: "boost", label: "Boost" },
  { value: "normal", label: "Normal" },
  { value: "reduce", label: "Reduce" },
  { value: "block", label: "Block" },
];

export function TagChip({
  label,
  size = "sm",
  interactive = false,
  currentWeight = "normal",
  onWeightChange,
}: TagChipProps) {
  const fontSize = size === "sm" ? "xs" : "sm";
  const normalizedWeight = currentWeight?.toLowerCase() || "normal";
  const colorProps = weightColors[normalizedWeight] || weightColors.normal;

  const chip = (
    <Badge
      fontSize={fontSize}
      px={2}
      py={0.5}
      borderRadius="md"
      fontWeight="medium"
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
    <Menu.Root>
      <Menu.Trigger
        asChild
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
        }}
      >
        {chip}
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup
              value={normalizedWeight}
              onValueChange={(details) => {
                onWeightChange?.(details.value);
              }}
            >
              {weightOptions.map((option) => (
                <Menu.RadioItem key={option.value} value={option.value}>
                  {option.label}
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
