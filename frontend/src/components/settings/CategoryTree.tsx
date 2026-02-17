"use client";

import React, { useMemo } from "react";
import { Stack, Box } from "@chakra-ui/react";
import { CategoryParentRow } from "./CategoryParentRow";
import { CategoryChildRow } from "./CategoryChildRow";

interface CategoryTreeProps {
  children: Record<string, string[]>;
  ungroupedCategories: string[];
  topicWeights: Record<string, string> | null;
  newCategories: Set<string>;
  returnedCategories: Set<string>;
  onWeightChange: (category: string, weight: string) => void;
  onResetWeight: (category: string) => void;
  onHide: (category: string) => void;
  onBadgeDismiss: (category: string) => void;
  isDndEnabled?: boolean;
  activeId?: string | null;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}

const CategoryTreeComponent = ({
  children,
  ungroupedCategories,
  topicWeights,
  newCategories,
  returnedCategories,
  onWeightChange,
  onResetWeight,
  onHide,
  onBadgeDismiss,
  isDndEnabled = false,
  activeId,
  onRename,
  onDelete,
}: CategoryTreeProps) => {
  // Sort parents alphabetically
  const sortedParents = useMemo(() => {
    return Object.keys(children).sort((a, b) => a.localeCompare(b));
  }, [children]);

  // Sort ungrouped categories alphabetically
  const sortedUngrouped = useMemo(() => {
    return [...ungroupedCategories].sort((a, b) => a.localeCompare(b));
  }, [ungroupedCategories]);

  const getEffectiveWeight = (category: string, parentCategory?: string): string => {
    // Explicit weight takes precedence
    if (topicWeights?.[category]) {
      return topicWeights[category];
    }
    // Inherit from parent if parent exists
    if (parentCategory && topicWeights?.[parentCategory]) {
      return topicWeights[parentCategory];
    }
    // Default
    return "normal";
  };

  const isOverridden = (category: string): boolean => {
    return topicWeights?.[category] !== undefined;
  };

  return (
    <Stack gap={1}>
      {sortedParents.map((parent) => {
        const childCategories = [...children[parent]].sort((a, b) => a.localeCompare(b));
        const parentWeight = topicWeights?.[parent] || "normal";

        return (
          <Box key={parent}>
            {/* Parent row */}
            <CategoryParentRow
              category={parent}
              weight={parentWeight}
              childCount={childCategories.length}
              onWeightChange={(weight) => onWeightChange(parent, weight)}
              isDndEnabled={isDndEnabled}
              activeId={activeId}
              onRename={(newName) => onRename(parent, newName)}
              onDelete={() => onDelete(parent)}
            />

            {/* Children with connector lines */}
            {childCategories.length > 0 && (
              <Box ml={6} pl={3} position="relative">
                <Stack gap={1}>
                  {childCategories.map((child, idx) => {
                    const effectiveWeight = getEffectiveWeight(child, parent);
                    const override = isOverridden(child);
                    const isLast = idx === childCategories.length - 1;

                    return (
                      <Box
                        key={child}
                        position="relative"
                        _before={{
                          content: '""',
                          position: "absolute",
                          left: "-12px",
                          top: 0,
                          width: "2px",
                          height: isLast ? "50%" : "calc(100% + 4px)",
                          bg: "border",
                        }}
                        _after={{
                          content: '""',
                          position: "absolute",
                          left: "-12px",
                          top: "50%",
                          width: "12px",
                          height: "2px",
                          bg: "border",
                        }}
                      >
                        <CategoryChildRow
                          category={child}
                          weight={effectiveWeight}
                          isOverridden={override}
                          parentWeight={parentWeight}
                          isNew={newCategories.has(child)}
                          isReturned={returnedCategories.has(child)}
                          onWeightChange={(weight) => onWeightChange(child, weight)}
                          onResetWeight={() => onResetWeight(child)}
                          onHide={() => onHide(child)}
                          onBadgeDismiss={() => onBadgeDismiss(child)}
                          isDndEnabled={isDndEnabled}
                          onRename={(newName) => onRename(child, newName)}
                          onDelete={() => onDelete(child)}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Ungrouped categories as simple leaf nodes */}
      {sortedUngrouped.map((category) => {
        const weight = topicWeights?.[category] || "normal";
        return (
          <CategoryChildRow
            key={category}
            category={category}
            weight={weight}
            isOverridden={isOverridden(category)}
            parentWeight="normal"
            isNew={newCategories.has(category)}
            isReturned={returnedCategories.has(category)}
            onWeightChange={(w) => onWeightChange(category, w)}
            onResetWeight={() => onResetWeight(category)}
            onHide={() => onHide(category)}
            onBadgeDismiss={() => onBadgeDismiss(category)}
            isDndEnabled={isDndEnabled}
            onRename={(newName) => onRename(category, newName)}
            onDelete={() => onDelete(category)}
          />
        );
      })}
    </Stack>
  );
};

export const CategoryTree = React.memo(CategoryTreeComponent);
