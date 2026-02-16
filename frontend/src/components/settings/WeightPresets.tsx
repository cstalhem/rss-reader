"use client";

import { Flex, Box, Button, IconButton, Group } from "@chakra-ui/react";
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
    <Flex alignItems="center" onClick={onClick}>
      <Group attached opacity={isOverridden === false ? 0.5 : 1}>
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
      </Group>
      <Box w={size === "xs" ? "28px" : "32px"} ml={0.5}>
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
          >
            <LuUndo2 size={size === "xs" ? 12 : 14} />
          </IconButton>
        )}
      </Box>
    </Flex>
  );
}
