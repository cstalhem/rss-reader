---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/settings/CategoryTree.tsx
  - frontend/src/components/settings/CategoryChildRow.tsx
  - frontend/src/components/settings/CategoryUngroupedRow.tsx
  - frontend/src/components/settings/CategoryParentRow.tsx
autonomous: true
requirements: [QUICK-12]

must_haves:
  truths:
    - "Clicking a checkbox in the categories bulk-edit responds instantly (no visible lag)"
    - "All category row functionality (weight change, rename, delete, hide, badge dismiss) still works correctly"
    - "React.memo on row components effectively prevents re-renders of unchanged rows"
  artifacts:
    - path: "frontend/src/components/settings/CategoryTree.tsx"
      provides: "Passes stable callback refs instead of inline closures to row components"
    - path: "frontend/src/components/settings/CategoryChildRow.tsx"
      provides: "Accepts ID-parameterized callbacks and binds category.id internally"
    - path: "frontend/src/components/settings/CategoryUngroupedRow.tsx"
      provides: "Accepts ID-parameterized callbacks and binds category.id internally"
    - path: "frontend/src/components/settings/CategoryParentRow.tsx"
      provides: "Accepts ID-parameterized callbacks and binds category.id internally"
  key_links:
    - from: "frontend/src/components/settings/CategoriesSection.tsx"
      to: "frontend/src/components/settings/CategoryTree.tsx"
      via: "useCallback refs passed as props"
      pattern: "onWeightChange=\\{handleWeightChange\\}"
    - from: "frontend/src/components/settings/CategoryTree.tsx"
      to: "CategoryChildRow/CategoryUngroupedRow/CategoryParentRow"
      via: "Stable callback refs passed through without inline closures"
      pattern: "onWeightChange=\\{onWeightChange\\}"
---

<objective>
Fix slow checkbox response in settings categories bulk-edit by eliminating inline arrow function closures in CategoryTree's .map() loops that defeat React.memo on row components.

Purpose: When a checkbox is toggled, `selectedIds` gets a new Set reference, causing CategoryTree to re-render. Currently, every row callback is an inline closure (`() => onFoo(id)`) that creates a new function reference, so ALL rows re-render despite React.memo. By passing stable ID-parameterized callbacks directly and letting each row bind its own `category.id`, React.memo will correctly skip unchanged rows.

Output: Four modified files where CategoryTree passes stable callbacks and row components handle their own ID binding.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/settings/CategoryTree.tsx
@frontend/src/components/settings/CategoryChildRow.tsx
@frontend/src/components/settings/CategoryUngroupedRow.tsx
@frontend/src/components/settings/CategoryParentRow.tsx
@frontend/src/components/settings/CategoriesSection.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor row component interfaces to accept ID-parameterized callbacks</name>
  <files>
    frontend/src/components/settings/CategoryChildRow.tsx
    frontend/src/components/settings/CategoryUngroupedRow.tsx
    frontend/src/components/settings/CategoryParentRow.tsx
  </files>
  <action>
Change the callback prop signatures in all three row components so they accept the category ID as a parameter, then bind `category.id` at call sites inside the component. The row components already receive `category` as a prop, so they have access to `category.id`.

**CategoryChildRow.tsx:**
Change interface from:
- `onWeightChange: (weight: string) => void` to `onWeightChange: (categoryId: number, weight: string) => void`
- `onResetWeight?: () => void` to `onResetWeight: (categoryId: number) => void`
- `onHide: () => void` to `onHide: (categoryId: number) => void`
- `onBadgeDismiss?: () => void` to `onBadgeDismiss: (categoryId: number) => void`
- `onRename: (newName: string) => void` to `onRename: (categoryId: number, newName: string) => void`
- `onDelete: () => void` to `onDelete: (categoryId: number) => void`
- `onToggleSelection: () => void` to `onToggleSelection: (id: number) => void`

Update internal call sites to pass `category.id`:
- `onToggleSelection()` becomes `onToggleSelection(category.id)`
- `onWeightChange(w)` becomes `onWeightChange(category.id, w)`
- `onBadgeDismiss?.()` becomes `onBadgeDismiss(category.id)`
- `onResetWeight?.()` becomes `onResetWeight(category.id)`
- `onHide()` becomes `onHide(category.id)`
- `onDelete()` becomes `onDelete(category.id)`
- For `onRename`, the `useRenameState` hook takes a callback — create a local rename handler: `const handleRename = useCallback((newName: string) => onRename(category.id, newName), [category.id, onRename])` and pass that to `useRenameState` instead of the raw prop.
- For `WeightPresetStrip onChange`, create a local handler: `const handleWeightChange = useCallback((weight: string) => onWeightChange(category.id, weight), [category.id, onWeightChange])` and pass that to the WeightPresetStrip components.
- For `WeightPresetStrip onReset`, create a local handler: `const handleResetWeight = useCallback(() => onResetWeight(category.id), [category.id, onResetWeight])` and pass that to the WeightPresetStrip components.
- For `CategoryContextMenu`, similarly create local handlers for `onResetWeight`, `onHide`, `onDelete` that bind `category.id`.

Import `useCallback` from React.

**CategoryUngroupedRow.tsx:**
Same pattern. Change interface:
- `onWeightChange: (weight: string) => void` to `onWeightChange: (categoryId: number, weight: string) => void`
- `onHide: () => void` to `onHide: (categoryId: number) => void`
- `onBadgeDismiss?: () => void` to `onBadgeDismiss: (categoryId: number) => void`
- `onToggleSelection: () => void` to `onToggleSelection: (id: number) => void`
- `onRename: (newName: string) => void` to `onRename: (categoryId: number, newName: string) => void`
- `onDelete: () => void` to `onDelete: (categoryId: number) => void`

Create local `useCallback` handlers that bind `category.id` for each callback that gets passed to child components (WeightPresetStrip, CategoryContextMenu, useRenameState).

**CategoryParentRow.tsx:**
Same pattern. Change interface:
- `onWeightChange: (weight: string) => void` to `onWeightChange: (categoryId: number, weight: string) => void`
- `onRename: (newName: string) => void` to `onRename: (categoryId: number, newName: string) => void`
- `onDelete: () => void` to `onDelete: (categoryId: number) => void`
- `onUngroup: () => void` to `onUngroup: (categoryId: number) => void`
- `onHide: () => void` to `onHide: (categoryId: number) => void`
- `onToggleExpand: () => void` to `onToggleExpand: (parentId: number) => void`

Create local `useCallback` handlers that bind `category.id` for WeightPresetStrip, CategoryContextMenu, useRenameState, and the toggle/chevron click.

Note: `onDismissNewChildren` can remain as `() => void` since it is only used on parent rows and the dismiss logic is already handled in CategoryTree by iterating the children set. However, see Task 2 for how CategoryTree will handle this.

Import `useCallback` from React in all three files.
  </action>
  <verify>Run `cd /Users/cstalhem/projects/rss-reader/frontend && npx tsc --noEmit` -- expect type errors in CategoryTree.tsx only (since it still passes old-style props). The row component files themselves should be clean.</verify>
  <done>All three row components accept ID-parameterized callback signatures and bind category.id internally via useCallback handlers.</done>
</task>

<task type="auto">
  <name>Task 2: Update CategoryTree to pass stable callback refs directly</name>
  <files>
    frontend/src/components/settings/CategoryTree.tsx
  </files>
  <action>
Now that row components accept ID-parameterized callbacks, CategoryTree can pass the stable refs from its props directly instead of wrapping them in inline closures.

**For CategoryChildRow (in the children.map loop):**
Replace all inline closures with direct prop pass-through:
```
onWeightChange={onWeightChange}        // was: (weight) => onWeightChange(child.id, weight)
onResetWeight={onResetWeight}          // was: () => onResetWeight(child.id)
onHide={onHide}                        // was: () => onHide(child.id)
onBadgeDismiss={onBadgeDismiss}        // was: () => onBadgeDismiss(child.id)
onRename={onRename}                    // was: (newName) => onRename(child.id, newName)
onDelete={onDelete}                    // was: () => onDelete(child.id)
onToggleSelection={onToggleSelection}  // was: () => onToggleSelection(child.id)
```

**For CategoryUngroupedRow (in the ungroupedCategories.map loop):**
Same direct pass-through:
```
onWeightChange={onWeightChange}        // was: (w) => onWeightChange(category.id, w)
onHide={onHide}                        // was: () => onHide(category.id)
onBadgeDismiss={onBadgeDismiss}        // was: () => onBadgeDismiss(category.id)
onToggleSelection={onToggleSelection}  // was: () => onToggleSelection(category.id)
onRename={onRename}                    // was: (newName) => onRename(category.id, newName)
onDelete={onDelete}                    // was: () => onDelete(category.id)
```

**For CategoryParentRow (in the parents.map loop):**
Pass stable refs directly:
```
onWeightChange={onWeightChange}        // was: (weight) => onWeightChange(parent.id, weight)
onRename={onRename}                    // was: (newName) => onRename(parent.id, newName)
onDelete={onDelete}                    // was: () => onDelete(parent.id)
onUngroup={onUngroup}                  // was: () => onUngroup(parent.id)
onHide={onHide}                        // was: () => onHide(parent.id)
onToggleExpand={onToggleParent}        // was: () => onToggleParent(parent.id)
```

**Update CategoryTreeProps interface** to match: `onToggleParent` should become `(parentId: number) => void` if not already.

**Handle onDismissNewChildren on parent row:** The current inline closure iterates `children.filter(c => newCategoryIds.has(c.id))` and calls `onBadgeDismiss` for each. This cannot be a simple pass-through. Two options:
1. Move the dismiss-all-children logic into the parent row component by also passing `children` and `newCategoryIds` as props.
2. Keep a single inline closure just for `onDismissNewChildren`.

Use option 2 (simpler, and this callback is only invoked on parent rows which are few in number -- not the hot path causing the performance issue). The parent row itself is not subject to the checkbox re-render issue since parents don't have checkboxes.

After changes, there should be ZERO inline arrow function closures for child and ungrouped row callbacks in the `.map()` loops.
  </action>
  <verify>
Run `cd /Users/cstalhem/projects/rss-reader/frontend && npx tsc --noEmit` -- expect zero type errors.
Run `cd /Users/cstalhem/projects/rss-reader/frontend && bun run build` -- expect successful build.
  </verify>
  <done>CategoryTree passes stable callback references to all row components. React.memo on CategoryChildRow and CategoryUngroupedRow now correctly prevents re-renders when only selectedIds changes (since all other props remain reference-equal for unchanged rows). The checkbox toggle should feel instant.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero errors in the frontend directory
2. `bun run build` succeeds
3. Manual test: Open settings, expand a parent with many children, rapidly click checkboxes -- response should be instant with no visible lag
</verification>

<success_criteria>
- Checkbox clicks in the categories bulk-edit UI respond instantly (no perceptible delay)
- All category management functionality (weight presets, rename, delete, hide, badge dismiss, context menu actions) works as before
- TypeScript compiles cleanly
- Production build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/12-fix-slow-checkbox-response-in-settings-c/12-SUMMARY.md`
</output>
