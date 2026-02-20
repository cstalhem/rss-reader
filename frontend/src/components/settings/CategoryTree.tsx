"use client";

import React from "react";
import { Stack, Box, Collapsible } from "@chakra-ui/react";
import { Category } from "@/lib/types";
import { CategoryParentRow } from "./CategoryParentRow";
import { CategoryChildRow } from "./CategoryChildRow";
import { CategoryUngroupedRow } from "./CategoryUngroupedRow";

interface CategoryTreeProps {
  parents: Category[];
  childrenMap: Record<number, Category[]>;
  ungroupedCategories: Category[];
  newCategoryIds: Set<number>;
  onWeightChange: (categoryId: number, weight: string) => void;
  onResetWeight: (categoryId: number) => void;
  onHide: (categoryId: number) => void;
  onBadgeDismiss: (categoryId: number) => void;
  onRename: (categoryId: number, newName: string) => void;
  onDelete: (categoryId: number) => void;
  onUngroup: (categoryId: number) => void;
  selectedIds: Set<number>;
  onToggleSelection: (id: number) => void;
  expandedParents: Record<number, boolean>;
  onToggleParent: (parentId: number) => void;
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
  onRename,
  onDelete,
  onUngroup,
  selectedIds,
  onToggleSelection,
  expandedParents,
  onToggleParent,
}: CategoryTreeProps) => {
  return (
    <Stack gap={1}>
      {parents.map((parent) => {
        const children = childrenMap[parent.id] ?? [];
        const parentWeight = parent.weight ?? "normal";
        const isExpanded = expandedParents[parent.id] ?? false;

        // Count new children for collapsed badge
        const newChildCount = children.filter((c) =>
          newCategoryIds.has(c.id)
        ).length;

        return (
          <Box key={parent.id}>
            {/* Parent row */}
            <CategoryParentRow
              category={parent}
              weight={parentWeight}
              childCount={children.length}
              onWeightChange={onWeightChange}
              onRename={onRename}
              onDelete={onDelete}
              onUngroup={onUngroup}
              onHide={onHide}
              isExpanded={isExpanded}
              onToggleExpand={onToggleParent}
              newChildCount={newChildCount}
              onDismissNewChildren={() => {
                const newChildIds = children
                  .filter((c) => newCategoryIds.has(c.id))
                  .map((c) => c.id);
                newChildIds.forEach((id) => onBadgeDismiss(id));
              }}
            />

            {/* Children with connector lines inside Collapsible */}
            {children.length > 0 && (
              <Collapsible.Root open={isExpanded}>
                <Collapsible.Content>
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
                              onWeightChange={onWeightChange}
                              onResetWeight={onResetWeight}
                              onHide={onHide}
                              onBadgeDismiss={onBadgeDismiss}
                              onRename={onRename}
                              onDelete={onDelete}
                              isSelected={selectedIds.has(child.id)}
                              onToggleSelection={onToggleSelection}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                </Collapsible.Content>
              </Collapsible.Root>
            )}
          </Box>
        );
      })}

      {/* Ungrouped categories as simple leaf nodes */}
      {ungroupedCategories.map((category) => {
        const weight = category.weight ?? "normal";
        return (
          <CategoryUngroupedRow
            key={category.id}
            category={category}
            weight={weight}
            isNew={newCategoryIds.has(category.id)}
            isSelected={selectedIds.has(category.id)}
            onWeightChange={onWeightChange}
            onHide={onHide}
            onBadgeDismiss={onBadgeDismiss}
            onToggleSelection={onToggleSelection}
            onRename={onRename}
            onDelete={onDelete}
          />
        );
      })}
    </Stack>
  );
};

export const CategoryTree = React.memo(CategoryTreeComponent);
