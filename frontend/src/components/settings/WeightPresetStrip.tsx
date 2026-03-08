"use client";

import React from "react";
import { Flex, Box, Button } from "@chakra-ui/react";
import {
  LuShieldBan,
  LuChevronDown,
  LuMinus,
  LuChevronUp,
  LuChevronsUp,
} from "react-icons/lu";

const WEIGHT_OPTIONS = [
  { value: "block", icon: LuShieldBan, label: "Block", color: "red", separated: true },
  { value: "reduce", icon: LuChevronDown, label: "Reduce", color: "orange" },
  { value: "normal", icon: LuMinus, label: "Normal", color: "gray" },
  { value: "boost", icon: LuChevronUp, label: "Boost", color: "green" },
  { value: "max", icon: LuChevronsUp, label: "Max", color: "yellow" },
];

interface WeightPresetStripProps {
  value: string;
  onChange: (weight: string) => void;
  isOverridden?: boolean; // true = explicit override, false = inherited, undefined = root
}

const WeightPresetStripComponent = ({
  value,
  onChange,
  isOverridden,
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
              <Box
                overflow={{ md: isActive ? undefined : "hidden" }}
                maxW={{ md: isActive ? undefined : isExpanded ? "8" : "0" }}
                transition={{ md: isActive ? undefined : "max-width 0.2s ease-out" }}
              >
                <Button
                  size="2xs"
                  variant={isActive ? "outline" : "subtle"}
                  colorPalette={isActive ? "accent" : undefined}
                  borderColor={isActive ? "accent.solid" : undefined}
                  color={isActive ? "accent.solid" : undefined}
                  aria-label={option.label}
                  title={option.label}
                  onClick={handleClick}
                  px={{ base: "6px", md: "4px" }}
                  minW={{ base: "28px", md: "24px" }}
                  minH={{ base: "28px" }}
                >
                  <Icon size={12} />
                </Button>
              </Box>
              {option.separated && (
                <Box
                  h={4}
                  borderLeftWidth="1px"
                  borderColor="border.subtle"
                  mx={1}
                  display={{ base: "block", md: isExpanded ? "block" : "none" }}
                />
              )}
            </React.Fragment>
          );
        })}
      </Flex>
    </Flex>
  );
};

export const WeightPresetStrip = React.memo(WeightPresetStripComponent);
