---
status: resolved
trigger: "parent-split-vs-delete - Deleting a parent category removes it entirely instead of splitting the group"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17
---

## Current Focus

hypothesis: CONFIRMED — Plan 08.1-05 said "keep in manually_created" but implementation removes from manually_created. Manually created parents that were never assigned by LLM disappear from GET /api/categories.
test: Confirmed by reading plan specification and backend implementation
expecting: Root cause documented, ready to return diagnosis
next_action: Return diagnosis to orchestrator

## Symptoms

expected: Parent delete action splits the group — parent becomes ungrouped, children are released to root level, all categories preserved
actual: User reported: "There is only a delete button for the category (but it is not visible), so the top level category is completely deleted rather than the group being split."
errors: None reported
reproduction: Test 10 in UAT round 2 — hover over a parent category with children, click the delete button. The parent category is deleted from the system entirely.
started: Plan 08.1-05 updated backend delete to "split group with logging" but the frontend may still be calling a full delete operation.

## Eliminated

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: Backend DELETE /api/categories endpoint (main.py lines 982-1039)
  found: |
    Backend delete logic (line 994-1001):
    - If category is a parent (has entry in children dict), removes parent key from children map and logs "parent split"
    - If category is a child, removes it from parent's child list
    - Removes from manually_created list
    - Removes from topic_weights
    BUT: Does NOT add parent back to children map as empty entry. The parent key is simply removed.
  implication: Backend "split" only releases children from grouping. Parent category can still exist in topic_weights/articles but is NOT preserved as an ungrouped category in children map. This might be the disconnect.

- timestamp: 2026-02-17T00:02:00Z
  checked: Frontend CategoryParentRow.tsx delete button (lines 134-149)
  found: onDelete prop is called when trash icon clicked. This component doesn't know about mutation logic.
  implication: Need to check how CategoriesSection wires up the delete mutation.

- timestamp: 2026-02-17T00:03:00Z
  checked: Frontend api.ts deleteCategory function (lines 359-369)
  found: Calls DELETE /api/categories with { name } in body. Straightforward wrapper, no frontend transformation.
  implication: Frontend directly calls backend delete endpoint. The behavior is entirely determined by backend logic.

- timestamp: 2026-02-17T00:04:00Z
  checked: CategoriesSection.tsx handleDeleteCategory and deleteCategory mutation (lines 353-368, 78-86)
  found: |
    - handleDeleteCategory determines if category is parent (checks if name in children keys)
    - Opens DeleteCategoryDialog with parent status
    - Dialog message says "The X child categories will be released to the root level" for parents
    - On confirm, calls deleteCategory(name) which invokes apiDeleteCategory
    - useCategories hook wraps apiDeleteCategory in mutation, invalidates queries on success
  implication: Frontend expects backend delete to "release children to root" but doesn't check what happens to parent itself.

- timestamp: 2026-02-17T00:05:00Z
  checked: DeleteCategoryDialog.tsx messaging (lines 37-48)
  found: Dialog says for parents "The X child categories will be released to the root level. Their individual weight overrides will be preserved." This implies children become ungrouped but says nothing about parent fate.
  implication: UI messaging doesn't clarify that parent category itself will disappear from the UI.

- timestamp: 2026-02-17T00:06:00Z
  checked: CategoriesSection.tsx ungroupedCategories calculation (lines 167-185)
  found: |
    ungroupedCategories = allCategories.filter((c) => {
      const lower = c.toLowerCase();
      return !childSet.has(lower) && !parentSet.has(lower) && !hidden.has(lower);
    });

    Where parentSet = Object.keys(categoryGroups.children) — categories that have a key in children map.

    When backend deletes a parent (removes parent key from children), the parent is no longer in parentSet, BUT:
    - If parent category no longer appears in any article.categories, it disappears from allCategories entirely
    - If parent still appears in articles, it SHOULD appear in ungroupedCategories (not in childSet, not in parentSet, not hidden)
  implication: Root cause depends on whether deleted parent still exists in allCategories after backend delete. Backend removes from manually_created but NOT from articles.

- timestamp: 2026-02-17T00:07:00Z
  checked: Backend GET /api/categories endpoint (main.py lines 649-676)
  found: |
    Returns sorted list of unique categories from:
    1. DEFAULT_CATEGORIES (seed list)
    2. Categories from scored articles (article.categories)
    3. manually_created from UserPreferences

    So if a parent category appears in any article.categories[], it will still be in allCategories even after backend delete removes it from children map and manually_created.
  implication: If parent was auto-discovered (exists in articles), it SHOULD appear in ungroupedCategories after split. If it was manually created and never assigned to articles, it disappears.

- timestamp: 2026-02-17T00:08:00Z
  checked: Plan 08.1-05 delete behavior specification (lines 104-107)
  found: |
    Plan explicitly says: "Change behavior from 'delete parent, release children' to 'split group':
    - If category is parent: remove from children map (makes it ungrouped), keep in manually_created"

    But actual implementation (main.py line 1023) removes from manually_created.
  implication: Implementation contradicts plan. This is the core bug — plan said "keep in manually_created" but code removes it.

## Resolution

root_cause: |
  DESIGN CONFLICT between plan intent and actual implementation:

  **Plan 08.1-05 intent (lines 104-107):**
  "Change behavior from 'delete parent, release children' to 'split group':
  - If category is parent: remove from children map (makes it ungrouped), keep in manually_created"

  **Actual backend implementation (main.py lines 994-1001):**
  - Removes parent key from children map (releases children)
  - Removes from manually_created (line 1023)
  - Removes from topic_weights (lines 1026-1028)

  **Result:** Backend removes parent from children map AND manually_created, which causes:
  1. If parent was manually created and never assigned to articles -> disappears entirely from GET /api/categories
  2. If parent appears in articles -> remains in allCategories but frontend ungrouped calculation correctly shows it as ungrouped

  **User confusion source:** The term "split" in plan 08.1-05 was misinterpreted. Plan said "keep in manually_created" but implementation removed from manually_created. Additionally, the DeleteCategoryDialog message says children will be "released to the root level" but doesn't clarify what happens to the parent category itself.

  **Actual behavior vs user expectation:**
  - Backend: "Split" = remove parent from children map, remove from manually_created, keep category data in articles
  - User expectation: "Split" = parent becomes ungrouped category, children become ungrouped categories, nobody gets deleted

  The backend behavior is actually CORRECT for most use cases (if parent was auto-discovered, it remains in articles and appears as ungrouped). The issue is:
  1. Manually created parent categories that were never assigned by LLM disappear entirely
  2. UI messaging doesn't explain this distinction

fix:
verification:
files_changed: []
