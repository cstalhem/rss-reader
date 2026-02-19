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
            <React.Fragment key={option.value}>
              {/* Mobile: Button with icon + text label */}
              <Button
                display={{ base: "inline-flex", md: "none" }}
                size="xs"
                variant={isActive ? "outline" : "ghost"}
                colorPalette={isActive ? "accent" : undefined}
                borderColor={isActive ? "accent.solid" : undefined}
                color={isActive ? "accent.solid" : undefined}
                onClick={handleClick}
                h="24px"
                px="6px"
              >
                <Icon size={12} />
                {option.label}
              </Button>

              {/* Desktop: IconButton with tooltip, animated expand/collapse */}
              <Box
                display={{ base: "none", md: "block" }}
                overflow={isActive ? undefined : "hidden"}
                maxW={isActive ? undefined : isExpanded ? "24px" : "0"}
                transition={isActive ? undefined : "max-width 0.2s ease-out"}
              >
                <Tooltip
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
                    onClick={handleClick}
                    minW="24px"
                    h="24px"
                    p="4px"
                  >
                    <Icon size={12} />
                  </IconButton>
                </Tooltip>
              </Box>
            </React.Fragment>
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
