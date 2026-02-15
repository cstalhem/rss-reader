"use client";

import { Flex, Button, IconButton } from "@chakra-ui/react";
import { LuUndo2 } from "react-icons/lu";

const WEIGHT_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "reduce", label: "Reduce" },
  { value: "normal", label: "Normal" },
  { value: "boost", label: "Boost" },
  { value: "max", label: "Max" },
];

interface WeightPresetsProps {
  value: string;
  onChange: (weight: string) => void;
  isOverridden?: boolean;
  onReset?: () => void;
  size?: "sm" | "xs";
  onClick?: (e: React.MouseEvent) => void;
}

export function WeightPresets({
  value,
  onChange,
  isOverridden,
  onReset,
  size = "xs",
  onClick,
}: WeightPresetsProps) {
  return (
    <Flex gap={0.5} alignItems="center" onClick={onClick}>
      {WEIGHT_OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <Button
            key={option.value}
            size={size}
            variant={isActive ? "solid" : "ghost"}
            colorPalette={isActive ? "accent" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onChange(option.value);
            }}
            px={size === "xs" ? 1.5 : 2}
            fontWeight={isActive ? "semibold" : "normal"}
            fontSize={size === "xs" ? "xs" : "sm"}
          >
            {option.label}
          </Button>
        );
      })}
      {isOverridden && onReset && (
        <IconButton
          aria-label="Reset to group weight"
          size={size}
          variant="ghost"
          colorPalette="accent"
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          ml={0.5}
        >
          <LuUndo2 size={size === "xs" ? 12 : 14} />
        </IconButton>
      )}
    </Flex>
  );
}
