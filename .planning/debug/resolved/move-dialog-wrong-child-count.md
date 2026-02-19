---
status: resolved
trigger: "Move to Group dialog shows wrong child count per parent group"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:00:00Z
---

## Current Focus

hypothesis: confirmed
test: code read complete
expecting: n/a
next_action: return diagnosis

## Symptoms

expected: Each parent group in the dialog shows a count of how many child categories it contains
actual: The number shown does not match the actual count of children for that group
errors: none (visual mismatch only)
reproduction: Open "Move to Group" dialog; note count next to each parent group name
started: unknown / design gap

## Eliminated

- hypothesis: count comes from childrenMap computed in CategoriesSection
  evidence: Dialog receives `parentCategories={parents}` (the raw Category objects), not childrenMap
  timestamp: 2026-02-19

- hypothesis: count is computed somewhere inside MoveToGroupDialog
  evidence: MoveToGroupDialog renders `parent.article_count ?? 0` directly from the Category object; no derived count
  timestamp: 2026-02-19

## Evidence

- timestamp: 2026-02-19
  checked: MoveToGroupDialog.tsx line 101
  found: Displays `parent.article_count ?? 0` as the count next to each parent name
  implication: The number shown is "how many articles are tagged with this parent category", NOT "how many child categories are in this group"

- timestamp: 2026-02-19
  checked: CategoriesSection.tsx lines 425-432
  found: `parentCategories={parents}` is passed — `parents` is an array of Category objects from the flat API response
  implication: No child count is derived or attached before passing to the dialog

- timestamp: 2026-02-19
  checked: /api/categories endpoint (main.py lines 749-776)
  found: article_count is computed via LEFT JOIN on ArticleCategoryLink — it counts articles tagged with that category
  implication: For parent/group categories, article_count counts direct article associations to the parent, which is almost always 0 or very low (articles are tagged to leaf children, not parents)

- timestamp: 2026-02-19
  checked: CategoriesSection.tsx lines 86-114 (useMemo building childrenMap)
  found: childrenMap is available in scope but is NOT passed to MoveToGroupDialog
  implication: The correct child count (number of child categories) is already computed locally via childrenMap but not used

## Resolution

root_cause: |
  MoveToGroupDialog displays `parent.article_count` (articles associated with the parent category row
  in the database) as if it were the child-category count. For group/parent categories, article_count
  is almost always 0 or meaningless — articles are tagged to child categories, not to the parent row
  itself. The correct count (number of child categories) is available in childrenMap in
  CategoriesSection but is never passed to the dialog.

fix: |
  Two changes needed:

  1. In CategoriesSection.tsx, pass childrenMap to MoveToGroupDialog as a new prop (e.g.,
     `childrenMap={childrenMap}`).

  2. In MoveToGroupDialog.tsx, accept `childrenMap: Record<number, Category[]>` in props and render
     `(childrenMap[parent.id]?.length ?? 0)` instead of `parent.article_count`.

  This way the count reflects how many children each group currently contains, which is what the
  user expects when deciding where to move categories.

files_changed: []
