"use client";

import React from "react";
import { Flex, Box, Button, IconButton } from "@chakra-ui/react";
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
  const [isExpanded, setIsExpanded] = React.useState(false);

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
          const isActive = value === option.value;
          const Icon = option.icon;

          const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onChange(option.value);
          };

          return (
            <Box
              key={option.value}
              overflow={{ md: isActive ? undefined : "hidden" }}
              maxW={{ md: isActive ? undefined : isExpanded ? "auto" : "0" }}
              transition={{ md: isActive ? undefined : "max-width 0.2s ease-out" }}
            >
              <Tooltip
                content={option.label}
                openDelay={300}
              >
                <Button
                  size="xs"
                  variant={isActive ? "outline" : "ghost"}
                  colorPalette={isActive ? "accent" : undefined}
                  borderColor={isActive ? "accent.solid" : undefined}
                  color={isActive ? "accent.solid" : undefined}
                  onClick={handleClick}
                  h="24px"
                  px={{ base: "6px", md: "4px" }}
                  minW={{ md: "24px" }}
                >
                  <Icon size={12} />
                  <Box as="span" display={{ base: "inline", md: "none" }}>
                    {option.label}
                  </Box>
                </Button>
              </Tooltip>
            </Box>
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
