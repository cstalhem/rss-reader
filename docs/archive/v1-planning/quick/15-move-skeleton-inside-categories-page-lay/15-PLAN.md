---
phase: quick-15
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/settings/CategoriesSection.tsx
autonomous: true
requirements: [QUICK-15]

must_haves:
  truths:
    - "Page header (title + new badge + create button), action bar, and search input render immediately on page load"
    - "Category tree area shows skeleton while data is loading"
    - "Empty state only shows when data has finished loading and there are truly zero categories"
    - "Hidden categories section does not flash empty content during loading"
  artifacts:
    - path: "frontend/src/components/settings/CategoriesSection.tsx"
      provides: "Categories page with inline skeleton loading"
      contains: "isLoading ? <CategoriesTreeSkeleton"
  key_links:
    - from: "CategoriesSection.tsx"
      to: "CategoriesTreeSkeleton"
      via: "conditional render in main return block"
      pattern: "isLoading \\? <CategoriesTreeSkeleton"
---

<objective>
Move the skeleton loading state inside the categories page layout so that the page chrome (header, action bar, search) renders immediately while only the category tree area shows the skeleton during data loading.

Purpose: Eliminate the full-page skeleton flash when navigating to categories -- the page structure should be instantly visible with only the data-dependent tree area showing a loading state.
Output: Modified CategoriesSection.tsx with inline skeleton placement.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/settings/CategoriesSection.tsx
@frontend/src/components/settings/CategoriesTreeSkeleton.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move skeleton inside page layout</name>
  <files>frontend/src/components/settings/CategoriesSection.tsx</files>
  <action>
Three surgical edits in CategoriesSection.tsx:

1. **Remove the `isLoading` early return** (lines 324-326): Delete the `if (isLoading) { return <CategoriesTreeSkeleton />; }` block entirely. This currently blocks the entire page render during loading.

2. **Guard the empty state**: Change the condition on line 328 from `if (categories.length === 0)` to `if (!isLoading && categories.length === 0)` so the empty state only shows after data has actually loaded and is genuinely empty -- prevents flashing the empty state before data arrives.

3. **Replace CategoryTree with conditional render**: In the main return block, replace the `<CategoryTree ... />` JSX (lines 394-410) with:
   ```
   {isLoading ? (
     <CategoriesTreeSkeleton />
   ) : (
     <CategoryTree
       parents={filteredParents}
       childrenMap={filteredChildrenMap}
       ungroupedCategories={filteredUngrouped}
       newCategoryIds={newCategoryIds}
       onWeightChange={handleWeightChange}
       onResetWeight={handleResetWeight}
       onHide={handleHideCategory}
       onBadgeDismiss={handleBadgeDismiss}
       onRename={handleRenameCategory}
       onDelete={handleDeleteCategory}
       onUngroup={handleUngroupParent}
       selectedIds={selectedIds}
       onToggleSelection={toggleSelection}
       expandedParents={expandedParents}
       onToggleParent={toggleParent}
     />
   )}
   ```

4. **Guard HiddenCategoriesSection**: Wrap the `<HiddenCategoriesSection ... />` (line 471-474) with `{!isLoading && ...}` so it does not render during loading (hiddenCategories is empty during load anyway, but avoids a flash of the collapsible section header):
   ```
   {!isLoading && (
     <HiddenCategoriesSection
       hiddenCategories={hiddenCategories}
       onUnhide={handleUnhideCategory}
     />
   )}
   ```

Do NOT change any other code. The header, action bar, search, dialogs, and all other elements render fine with empty/default data during loading.
  </action>
  <verify>
Run `cd /Users/cstalhem/projects/rss-reader/frontend && bun run build` -- no type errors or build failures.
Visually: on page load, the header row (title + badge + create button), action bar, and search input appear immediately; only the tree area shows the skeleton.
  </verify>
  <done>
The isLoading early return is removed. The empty state is guarded by `!isLoading`. The CategoryTree block is replaced with a conditional that shows CategoriesTreeSkeleton during loading and CategoryTree after. HiddenCategoriesSection only renders when not loading. Build passes.
  </done>
</task>

</tasks>

<verification>
- `bun run build` succeeds with no errors
- Page header, action bar, and search render immediately (no skeleton covering them)
- Category tree area shows skeleton during loading
- Empty state does not flash before data arrives
- Hidden categories section does not flash during loading
</verification>

<success_criteria>
Categories page renders its chrome (header, action bar, search) instantly on navigation, with only the tree content area showing a skeleton during data fetch.
</success_criteria>

<output>
After completion, create `.planning/quick/15-move-skeleton-inside-categories-page-lay/15-SUMMARY.md`
</output>
