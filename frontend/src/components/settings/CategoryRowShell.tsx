"use client";

import React from "react";
import { Box, Flex, Input, Text } from "@chakra-ui/react";
import { Category } from "@/lib/types";
import { useRenameState } from "@/hooks/useRenameState";
import { WeightPresetStrip } from "./WeightPresetStrip";

interface CategoryRowShellProps {
  children: React.ReactNode; // Left-side unique content: chevron+folder (parent), checkbox (child/ungrouped)
  category: Category; // For rename state and display name
  weight: string; // Current weight value
  onWeightChange: (weight: string) => void;
  onRename: (newName: string) => void;
  renderContextMenu: (startRename: () => void) => React.ReactNode;
  isOverridden?: boolean; // For WeightPresetStrip opacity + reset button
  onReset?: () => void; // Reset to parent weight
  badge?: React.ReactNode; // "New" badge, "N new" badge
  trailingContent?: React.ReactNode; // Child count text (for parent rows)
  onHoverChange?: (isHovered: boolean) => void; // For badge X animation on child/ungrouped
  onNameClick?: () => void; // Category name click handler (for parent expand/collapse)
  nameFontWeight?: string; // Font weight for name text (semibold for parent)
  py?: number; // Vertical padding override (parent=3, child/ungrouped=2)
}

export function CategoryRowShell({
  children,
  category,
  weight,
  onWeightChange,
  onRename,
  renderContextMenu,
  isOverridden,
  onReset,
  badge,
  trailingContent,
  onHoverChange,
  onNameClick,
  nameFontWeight,
  py = 2,
}: CategoryRowShellProps) {
  const { isRenaming, renameValue, setRenameValue, startRename, handleSubmit, handleCancel, inputRef } =
    useRenameState(category.display_name, onRename);

  return (
    <Box
      borderWidth={{ base: "1px", sm: "0" }}
      borderColor="border.subtle"
      borderRadius={{ base: "md", sm: "sm" }}
      bg="bg.subtle"
      _hover={{ bg: "bg.muted" }}
      transition="background 0.15s"
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
    >
      <Flex
        role="group"
        alignItems="center"
        gap={2}
        flexWrap={{ base: "wrap", sm: "nowrap" }}
        py={py}
        px={3}
      >
        {children}

        {isRenaming ? (
          <Input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSubmit();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
            onBlur={handleSubmit}
            size="sm"
            flex={1}
          />
        ) : (
          <Text
            fontSize="sm"
            fontWeight={nameFontWeight}
            truncate
            cursor={onNameClick ? "pointer" : undefined}
            onClick={onNameClick}
          >
            {category.display_name}
          </Text>
        )}

        {trailingContent}

        {badge}

        <Box flex={1} />

        <Box
          width={{ base: "100%", sm: "auto" }}
          order={{ base: 99, sm: 0 }}
        >
          <WeightPresetStrip
            value={weight}
            onChange={onWeightChange}
            isOverridden={isOverridden}
            onReset={onReset}
          />
        </Box>

        {!isRenaming && (
          <Box minH={{ base: "44px", sm: "auto" }} display="flex" alignItems="center">
            {renderContextMenu(startRename)}
          </Box>
        )}
      </Flex>
    </Box>
  );
}
