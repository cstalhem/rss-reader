---
phase: quick-14
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/settings/CategoriesSection.tsx
  - frontend/src/components/settings/CategoriesTreeSkeleton.tsx
autonomous: true
requirements: [QUICK-14]

must_haves:
  truths:
    - "Navigating to the categories tab shows a structured skeleton instantly (no blank delay)"
    - "Skeleton visually approximates the tree layout: parent rows with indented child rows"
    - "Skeleton is replaced by real content once categories data loads"
  artifacts:
    - path: "frontend/src/components/settings/CategoriesTreeSkeleton.tsx"
      provides: "Skeleton component mimicking category tree structure"
      min_lines: 20
    - path: "frontend/src/components/settings/CategoriesSection.tsx"
      provides: "Renders skeleton when isLoading is true"
      contains: "CategoriesTreeSkeleton"
  key_links:
    - from: "frontend/src/components/settings/CategoriesSection.tsx"
      to: "frontend/src/components/settings/CategoriesTreeSkeleton.tsx"
      via: "import and render in isLoading branch"
      pattern: "isLoading.*CategoriesTreeSkeleton"
---

<objective>
Replace the generic single-block skeleton in CategoriesSection with a structured skeleton that approximates the visual layout of the category tree (parent rows with indented children).

Purpose: When the user navigates to the categories tab on desktop (conditional mount from quick-13), there is a visible delay before content appears. A tree-shaped skeleton provides immediate visual feedback matching the expected layout.

Output: CategoriesTreeSkeleton component rendered during the isLoading state of the categories query.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/settings/CategoriesSection.tsx
@frontend/src/components/settings/CategoryTree.tsx
@frontend/src/components/settings/CategoryParentRow.tsx
@frontend/src/components/settings/CategoryChildRow.tsx
@frontend/src/components/article/ArticleRowSkeleton.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create CategoriesTreeSkeleton and wire it into CategoriesSection</name>
  <files>
    frontend/src/components/settings/CategoriesTreeSkeleton.tsx
    frontend/src/components/settings/CategoriesSection.tsx
  </files>
  <action>
Create `CategoriesTreeSkeleton.tsx` in `frontend/src/components/settings/`. This is a presentational component that renders a static skeleton approximating the category tree layout.

Structure to mimic (3 parent groups with children, plus a few ungrouped rows):

1. A title skeleton (matching the "Topic Categories" heading: ~180px wide, ~24px tall)
2. A search input skeleton (full width, ~32px tall, matching the filter input)
3. Three "parent group" skeletons, each consisting of:
   - A parent row: Flex with a small circle skeleton (chevron placeholder, ~14px), a small circle (folder icon, ~16px), a text skeleton (~120-180px, varying widths), and a small count skeleton (~24px)
   - Two indented child rows per parent: ml={6} pl={3} offset matching CategoryTree's child indentation, each with a small checkbox skeleton (~16px), a text skeleton (~80-140px, varying widths)
4. Two ungrouped row skeletons at root level (similar to child rows but without indentation)

Use Chakra `Skeleton` with `variant="shine"` (consistent with ArticleRowSkeleton pattern). Use `Stack gap={1}` between rows to match CategoryTree spacing. Use `bg="bg.subtle"` on parent row skeletons and `py={3} px={3}` to match the real row padding.

Keep it simple -- no animation beyond Chakra's built-in shine. Vary skeleton widths to look natural (not all the same width).

Then update `CategoriesSection.tsx`:
- Import `CategoriesTreeSkeleton` from `./CategoriesTreeSkeleton`
- Replace the existing `isLoading` early return (lines 323-329, the single `<Skeleton height="200px" />`) with `<CategoriesTreeSkeleton />`
- Remove the `Skeleton` import from `@chakra-ui/react` on line 4 since it will no longer be used directly in CategoriesSection (verify no other usage of Skeleton remains in this file before removing)
  </action>
  <verify>
Run `cd /Users/cstalhem/projects/rss-reader/frontend && bun run build` to confirm no type or import errors. Visually inspect by reviewing the component structure matches the described layout.
  </verify>
  <done>
CategoriesSection shows a tree-shaped skeleton during loading that visually matches the parent/child hierarchy structure. The skeleton disappears when categories data resolves. Build passes with no errors.
  </done>
</task>

</tasks>

<verification>
- `cd frontend && bun run build` passes without errors
- CategoriesSection imports and renders CategoriesTreeSkeleton when isLoading is true
- CategoriesTreeSkeleton file exists with structured parent/child skeleton layout
</verification>

<success_criteria>
- Build succeeds
- Loading state shows structured tree skeleton instead of generic block
- Skeleton layout approximates: title, search bar, 3 parent groups with 2 children each, 2 ungrouped rows
</success_criteria>

<output>
After completion, create `.planning/quick/14-add-skeleton-loading-state-to-categories/14-SUMMARY.md`
</output>
