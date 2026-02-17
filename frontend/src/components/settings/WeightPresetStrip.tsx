"use client";

import React, { useState, useEffect } from "react";
import { Flex, Box, IconButton, Text } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  LuBan,
  LuChevronDown,
  LuMinus,
  LuChevronUp,
  LuChevronsUp,
  LuUndo2,
} from "react-icons/lu";

const WEIGHT_OPTIONS = [
  { value: "block", icon: LuBan, label: "Block", color: "red" },
  { value: "reduce", icon: LuChevronDown, label: "Reduce", color: "orange" },
  { value: "normal", icon: LuMinus, label: "Normal", color: "gray" },
  { value: "boost", icon: LuChevronUp, label: "Boost", color: "green" },
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
  const [localValue, setLocalValue] = useState(value);

  // Sync with prop when server data arrives (or on revert)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <Flex
      alignItems="center"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={(e) => e.stopPropagation()}
      opacity={isOverridden === false ? 0.5 : 1}
    >
      <Flex gap={0} alignItems="center">
        {WEIGHT_OPTIONS.map((option) => {
          const isActive = localValue === option.value;
          const Icon = option.icon;

          const button = (
            <Tooltip
              key={option.value}
              content={option.label}
              openDelay={300}
              disabled={false}
            >
              <IconButton
                aria-label={option.label}
                size="xs"
                variant={isActive ? "outline" : "ghost"}
                colorPalette={isActive ? "accent" : undefined}
                borderColor={isActive ? "accent.solid" : undefined}
                color={isActive ? "accent.solid" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setLocalValue(option.value); // instant visual update — same frame
                  onChange(option.value); // triggers mutation chain
                }}
                minW="24px"
                h="24px"
                p="4px"
              >
                <Icon size={12} />
              </IconButton>
            </Tooltip>
          );

          // Active icon always visible; inactive icons animate on desktop
          if (isActive) return button;

          return (
            <Box
              key={option.value}
              overflow="hidden"
              display={{ base: "block", md: "block" }}
              maxW={{ base: "24px", md: isExpanded ? "24px" : "0" }}
              transition="max-width 0.2s ease-out"
            >
              {button}
            </Box>
          );
        })}

        {/* Mobile text labels - only show on mobile */}
        {WEIGHT_OPTIONS.map((option) => {
          const isActive = localValue === option.value;
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
      <Box w="24px" ml={0.5}>
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
