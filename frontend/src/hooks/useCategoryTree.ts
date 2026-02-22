import { useMemo, useState } from "react";
import { Category } from "@/lib/types";

export function useCategoryTree(categories: Category[]) {
  const [searchQuery, setSearchQuery] = useState("");

  // Build tree from flat Category array
  const { parents, childrenMap, ungroupedCategories } = useMemo(() => {
    const cMap: Record<number, Category[]> = {};
    const parentIds = new Set<number>();

    // Group children by parent_id
    for (const cat of categories) {
      if (cat.parent_id !== null) {
        if (!cMap[cat.parent_id]) cMap[cat.parent_id] = [];
        cMap[cat.parent_id].push(cat);
        parentIds.add(cat.parent_id);
      }
    }

    // Parents: root-level categories that have children
    const parentCats = categories
      .filter((c) => c.parent_id === null && parentIds.has(c.id) && !c.is_hidden)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    // Ungrouped: root-level categories that have no children and are not hidden
    const ungrouped = categories
      .filter((c) => c.parent_id === null && !parentIds.has(c.id) && !c.is_hidden)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    // Sort children within each parent
    for (const parentId of Object.keys(cMap)) {
      cMap[Number(parentId)].sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    return { parents: parentCats, childrenMap: cMap, ungroupedCategories: ungrouped };
  }, [categories]);

  // New categories: unseen and not hidden
  const newCategoryIds = useMemo(() => {
    return new Set(
      categories
        .filter((c) => !c.is_seen && !c.is_hidden)
        .map((c) => c.id)
    );
  }, [categories]);

  // Hidden categories
  const hiddenCategories = useMemo(
    () =>
      categories
        .filter((c) => c.is_hidden)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [categories]
  );

  // Search filtering — return filtered versions as primary names
  const { filteredParents, filteredChildrenMap, filteredUngrouped } = useMemo(() => {
    if (!searchQuery) {
      return {
        filteredParents: parents,
        filteredChildrenMap: childrenMap,
        filteredUngrouped: ungroupedCategories,
      };
    }

    const query = searchQuery.toLowerCase();
    const newParents: Category[] = [];
    const newChildrenMap: Record<number, Category[]> = {};

    for (const parent of parents) {
      const parentMatches = parent.display_name.toLowerCase().includes(query);
      const children = childrenMap[parent.id] ?? [];
      const matchingChildren = children.filter((c) =>
        c.display_name.toLowerCase().includes(query)
      );

      if (parentMatches) {
        newParents.push(parent);
        newChildrenMap[parent.id] = children;
      } else if (matchingChildren.length > 0) {
        newParents.push(parent);
        newChildrenMap[parent.id] = matchingChildren;
      }
    }

    const newUngrouped = ungroupedCategories.filter((c) =>
      c.display_name.toLowerCase().includes(query)
    );

    return {
      filteredParents: newParents,
      filteredChildrenMap: newChildrenMap,
      filteredUngrouped: newUngrouped,
    };
  }, [searchQuery, parents, childrenMap, ungroupedCategories]);

  return {
    parents: filteredParents,
    childrenMap: filteredChildrenMap,
    ungroupedCategories: filteredUngrouped,
    newCategoryIds,
    hiddenCategories,
    searchQuery,
    setSearchQuery,
  };
}
