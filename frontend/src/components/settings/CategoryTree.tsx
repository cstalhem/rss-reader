"use client";

import React from "react";
import { Stack, Box } from "@chakra-ui/react";
import { Category } from "@/lib/types";
import { CategoryParentRow } from "./CategoryParentRow";
import { CategoryChildRow } from "./CategoryChildRow";

interface CategoryTreeProps {
  parents: Category[];
  childrenMap: Record<number, Category[]>;
  ungroupedCategories: Category[];
  newCategoryIds: Set<number>;
  onWeightChange: (categoryId: number, weight: string) => void;
  onResetWeight: (categoryId: number) => void;
  onHide: (categoryId: number) => void;
  onBadgeDismiss: (categoryId: number) => void;
  isDndEnabled?: boolean;
  activeId?: string | null;
  onRename: (categoryId: number, newName: string) => void;
  onDelete: (categoryId: number) => void;
}

function getEffectiveWeight(category: Category, parent?: Category): string {
  if (category.weight !== null) return category.weight;
  if (parent?.weight !== null && parent?.weight !== undefined) return parent.weight;
  return "normal";
}

const CategoryTreeComponent = ({
  parents,
  childrenMap,
  ungroupedCategories,
  newCategoryIds,
  onWeightChange,
  onResetWeight,
  onHide,
  onBadgeDismiss,
  isDndEnabled = false,
  activeId,
  onRename,
  onDelete,
}: CategoryTreeProps) => {
  return (
    <Stack gap={1}>
      {parents.map((parent) => {
        const children = childrenMap[parent.id] ?? [];
        const parentWeight = parent.weight ?? "normal";

        return (
          <Box key={parent.id}>
            {/* Parent row */}
            <CategoryParentRow
              category={parent}
              weight={parentWeight}
              childCount={children.length}
              onWeightChange={(weight) => onWeightChange(parent.id, weight)}
              isDndEnabled={isDndEnabled}
              activeId={activeId}
              onRename={(newName) => onRename(parent.id, newName)}
              onDelete={() => onDelete(parent.id)}
            />

            {/* Children with connector lines */}
            {children.length > 0 && (
              <Box ml={6} pl={3} position="relative">
                <Stack gap={1}>
                  {children.map((child, idx) => {
                    const effectiveWeight = getEffectiveWeight(child, parent);
                    const isOverridden = child.weight !== null;
                    const isLast = idx === children.length - 1;

                    return (
                      <Box
                        key={child.id}
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
                          isOverridden={isOverridden}
                          parentWeight={parentWeight}
                          isNew={newCategoryIds.has(child.id)}
                          onWeightChange={(weight) => onWeightChange(child.id, weight)}
                          onResetWeight={() => onResetWeight(child.id)}
                          onHide={() => onHide(child.id)}
                          onBadgeDismiss={() => onBadgeDismiss(child.id)}
                          isDndEnabled={isDndEnabled}
                          onRename={(newName) => onRename(child.id, newName)}
                          onDelete={() => onDelete(child.id)}
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
      {ungroupedCategories.map((category) => {
        const weight = category.weight ?? "normal";
        return (
          <CategoryChildRow
            key={category.id}
            category={category}
            weight={weight}
            isOverridden={category.weight !== null}
            parentWeight="normal"
            isNew={newCategoryIds.has(category.id)}
            onWeightChange={(w) => onWeightChange(category.id, w)}
            onResetWeight={() => onResetWeight(category.id)}
            onHide={() => onHide(category.id)}
            onBadgeDismiss={() => onBadgeDismiss(category.id)}
            isDndEnabled={isDndEnabled}
            onRename={(newName) => onRename(category.id, newName)}
            onDelete={() => onDelete(category.id)}
          />
        );
      })}
    </Stack>
  );
};

export const CategoryTree = React.memo(CategoryTreeComponent);
