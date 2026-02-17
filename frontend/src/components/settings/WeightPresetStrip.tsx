"use client";

import React, { useState } from "react";
import { Flex, Box, IconButton, Text } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  LuBan,
  LuArrowDown,
  LuMinus,
  LuArrowUp,
  LuChevronsUp,
  LuUndo2,
} from "react-icons/lu";

const WEIGHT_OPTIONS = [
  { value: "block", icon: LuBan, label: "Block", color: "red" },
  { value: "reduce", icon: LuArrowDown, label: "Reduce", color: "orange" },
  { value: "normal", icon: LuMinus, label: "Normal", color: "gray" },
  { value: "boost", icon: LuArrowUp, label: "Boost", color: "green" },
  { value: "max", icon: LuChevronsUp, label: "Max", color: "yellow" },
];

interface WeightPresetStripProps {
  value: string;
  onChange: (weight: string) => void;
  isOverridden?: boolean; // true = explicit override, false = inherited, undefined = root
  onReset?: () => void; // reset to parent weight
}

const WeightPresetStripComponent = ({
  value,
  onChange,
  isOverridden,
  onReset,
}: WeightPresetStripProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Flex
      alignItems="center"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={(e) => e.stopPropagation()}
      opacity={isOverridden === false ? 0.5 : 1}
    >
      <Flex gap={0}>
        {WEIGHT_OPTIONS.map((option) => {
          const isActive = value === option.value;
          const Icon = option.icon;

          // Desktop: show only active icon when collapsed, all when expanded
          // Mobile: always show all icons
          const isVisible =
            isActive || isExpanded
              ? { base: "flex", md: "flex" }
              : { base: "flex", md: "none" };

          return (
            <Tooltip
              key={option.value}
              content={option.label}
              openDelay={300}
              disabled={false}
            >
              <IconButton
                aria-label={option.label}
                size="xs"
                variant={isActive ? "solid" : "ghost"}
                colorPalette={isActive ? "accent" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(option.value);
                }}
                minW="28px"
                display={isVisible}
                transition="all 0.2s"
              >
                <Icon size={14} />
              </IconButton>
            </Tooltip>
          );
        })}

        {/* Mobile text labels - only show on mobile */}
        {WEIGHT_OPTIONS.map((option) => {
          const isActive = value === option.value;
          return (
            <Text
              key={`label-${option.value}`}
              display={{ base: "inline", md: "none" }}
              fontSize="xs"
              color={isActive ? "accent.fg" : "fg.muted"}
              ml={1}
              mr={2}
            >
              {option.label}
            </Text>
          );
        })}
      </Flex>

      {/* Reset button - only when overridden */}
      <Box w="28px" ml={0.5}>
        {isOverridden && onReset && (
          <IconButton
            aria-label="Reset to parent weight"
            size="xs"
            variant="ghost"
            colorPalette="accent"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
          >
            <LuUndo2 size={12} />
          </IconButton>
        )}
      </Box>
    </Flex>
  );
};

export const WeightPresetStrip = React.memo(WeightPresetStripComponent);
