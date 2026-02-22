"use client";

import React, { useCallback } from "react";
import { Stack, Box } from "@chakra-ui/react";
import { Category } from "@/lib/types";
import { useCategoryTreeContext } from "./CategoriesSection";
import { CategoryParentRow } from "./CategoryParentRow";
import { CategoryChildRow } from "./CategoryChildRow";
import { CategoryUngroupedRow } from "./CategoryUngroupedRow";

interface CategoryTreeProps {
  parents: Category[];
  childrenMap: Record<number, Category[]>;
  ungroupedCategories: Category[];
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
  expandedParents,
  onToggleParent,
}: CategoryTreeProps) => {
  const { newCategoryIds } = useCategoryTreeContext();

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
          <CategoryTreeParent
            key={parent.id}
            parent={parent}
            childCategories={children}
            parentWeight={parentWeight}
            isExpanded={isExpanded}
            onToggleParent={onToggleParent}
            newChildCount={newChildCount}
          />
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
          />
        );
      })}
    </Stack>
  );
};

// Extracted to keep inline closure for onDismissNewChildren clean
function CategoryTreeParent({
  parent,
  childCategories,
  parentWeight,
  isExpanded,
  onToggleParent,
  newChildCount,
}: {
  parent: Category;
  childCategories: Category[];
  parentWeight: string;
  isExpanded: boolean;
  onToggleParent: (parentId: number) => void;
  newChildCount: number;
}) {
  const { newCategoryIds, onBadgeDismiss } = useCategoryTreeContext();

  const handleDismissNewChildren = useCallback(() => {
    childCategories
      .filter((c) => newCategoryIds.has(c.id))
      .forEach((c) => onBadgeDismiss(c.id));
  }, [childCategories, newCategoryIds, onBadgeDismiss]);

  return (
    <Box>
      <CategoryParentRow
        category={parent}
        weight={parentWeight}
        childCount={childCategories.length}
        isExpanded={isExpanded}
        onToggleExpand={onToggleParent}
        newChildCount={newChildCount}
        onDismissNewChildren={handleDismissNewChildren}
      />

      {/* Children with connector lines - conditionally rendered */}
      {childCategories.length > 0 && isExpanded && (
        <Box ml={6} pl={3} position="relative">
          <Stack gap={1}>
            {childCategories.map((child, idx) => {
              const effectiveWeight = getEffectiveWeight(child, parent);
              const isOverridden = child.weight !== null;
              const isLast = idx === childCategories.length - 1;

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
                  />
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export const CategoryTree = React.memo(CategoryTreeComponent);
