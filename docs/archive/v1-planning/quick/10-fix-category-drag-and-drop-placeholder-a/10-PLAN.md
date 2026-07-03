---
phase: 10-fix-category-drag-and-drop-placeholder-a
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/settings/CategoryGroupAccordion.tsx
  - frontend/src/components/settings/CategoryRow.tsx
autonomous: true
requirements: [TODO-4]

must_haves:
  truths:
    - "Drag placeholder appears in destination container when dragging a category cross-container (group-to-group, group-to-ungrouped, ungrouped-to-group)"
    - "Drag placeholder does NOT appear in source container"
    - "Badge dismiss X icon has zero visual footprint when row is not hovered"
    - "Badge dismiss X icon smoothly expands on hover and is readable (14px)"
    - "No vertical divider between X icon and badge text"
  artifacts:
    - path: "frontend/src/components/settings/CategoryGroupAccordion.tsx"
      provides: "Group droppable with useDroppable ref on Accordion.Item level"
      contains: "setNodeRef"
    - path: "frontend/src/components/settings/CategoryRow.tsx"
      provides: "Badge chips with hover-reveal X icon"
  key_links:
    - from: "CategoryGroupAccordion.tsx"
      to: "@dnd-kit/core useDroppable"
      via: "ref on always-visible Accordion.Item wrapper"
      pattern: "setNodeRef"
    - from: "CategoryRow.tsx"
      to: "Badge dismiss X"
      via: "maxW transition with all spacing inside collapsing container"
---

<objective>
Fix two UX issues in category management: (1) drag-and-drop placeholder only showing in source container instead of destination, and (2) badge dismiss X icon having residual spacing when not hovered.

Purpose: Make cross-container drag-and-drop functional (placeholder guides user to drop target) and polish badge dismiss interaction.
Output: Updated CategoryGroupAccordion.tsx and CategoryRow.tsx with working drag placeholder and clean badge dismiss UX.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/settings/CategoryGroupAccordion.tsx
@frontend/src/components/settings/CategoryRow.tsx
@frontend/src/components/settings/CategoriesSection.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move useDroppable ref to Accordion.Item level for destination placeholder detection</name>
  <files>frontend/src/components/settings/CategoryGroupAccordion.tsx</files>
  <action>
The root cause of the placeholder never appearing in the destination: `useDroppable({ id: group.id })` has its `setNodeRef` attached to a `<Box>` inside `Accordion.ItemContent > Accordion.ItemBody` (line 196). When the accordion is collapsed, `Accordion.ItemContent` is hidden and the droppable element has zero dimensions. `@dnd-kit` uses bounding rects for collision detection — a zero-dimension droppable never registers `isOver=true`.

Fix:
1. Move the `setNodeRef` from the inner `<Box>` (line 196) to the `<Accordion.Item>` element (line 99). The `Accordion.Item` is always visible regardless of expanded/collapsed state, so collision detection will work.
   - `Accordion.Item` accepts a `ref` prop. Change `<Accordion.Item value={group.id}>` to `<Accordion.Item value={group.id} ref={setNodeRef}>`.
2. Remove the `ref={setNodeRef}` from the inner `<Box>` on line 196. Also remove `bg={isOver ? "bg.muted" : undefined}` and `p={isOver ? 1 : 0}` from that Box since the visual highlight should now be on the Accordion.Item level. Simplify the inner Box to just have `borderRadius="sm"` or remove it if it has no other styling purpose (keep it if it provides layout structure for the SortableContext children).
3. Add the `isOver` visual feedback to the `Accordion.Item` wrapper instead — apply a subtle background highlight via a style prop or additional Box wrapper: `bg={isOver ? "bg.muted" : undefined}` and `transition="background 0.15s"`.
4. The placeholder rendering (lines 238-257, already outside `Accordion.ItemContent`) should continue to work as-is since `isOver` will now correctly report true for destination groups.

Do NOT change: the `showPlaceholder` logic (lines 92-96), the placeholder JSX (lines 238-257), or the `sourceContainer` tracking. These are correct — the only problem was that `isOver` was never true for destinations because the droppable ref was on a hidden element.
  </action>
  <verify>
Run `cd /Users/cstalhem/projects/rss-reader/frontend && npx tsc --noEmit` to verify no type errors. Then run `bun run build` to ensure the production build succeeds. Visually: start the dev server, go to Settings > Categories, create two groups with categories, drag a category from one group to another — the dashed placeholder should appear in the destination group, NOT in the source group.
  </verify>
  <done>Dragging a category between containers shows the dashed placeholder row in the destination container. The placeholder does not appear in the source container. The droppable ref is on the always-visible Accordion.Item element.</done>
</task>

<task type="auto">
  <name>Task 2: Fix badge dismiss X icon spacing, size, and divider</name>
  <files>frontend/src/components/settings/CategoryRow.tsx</files>
  <action>
Three issues with the "New" and "Returned" badge chips:

1. **Reserved spacing when not hovered:** `<Box pl={2}>New</Box>` (line 127) and `<Box pl={2}>Returned</Box>` (line 155) always add 8px left padding even when the X is hidden. Fix: remove the `<Box pl={2}>` wrapper entirely. Render "New" / "Returned" as plain text directly inside the `<Flex>`. Move any needed left spacing into the collapsing `<Box>` that contains the X icon — specifically, add right padding (`pr`) to the collapsing container instead. This way when the collapsing container has `maxW: "0"`, no extra space is reserved.

2. **X icon too small:** Change `<LuX size={10} />` to `<LuX size={14} />` on both lines 125 and 153.

3. **Remove vertical divider:** Remove `borderRight={isHovered ? "1px solid" : undefined}` and `borderColor="border.subtle"` from both collapsing Box elements (lines 122-123 and 150-151).

Updated badge structure for both "New" and "Returned" badges should be approximately:
```tsx
<Badge colorPalette="accent" size="sm" cursor="pointer" onClick={...}>
  <Flex alignItems="center" gap={0}>
    <Box
      display="flex"
      alignItems="center"
      maxW={isHovered ? "20px" : "0"}
      overflow="hidden"
      transition="max-width 0.15s"
      pr={isHovered ? 1 : 0}
    >
      <LuX size={14} />
    </Box>
    New
  </Flex>
</Badge>
```

Increase `maxW` from `"16px"` to `"20px"` to accommodate the larger icon size (14px + 6px padding). Remove `pl` from the collapsing Box (was `pl={isHovered ? 1.5 : 0}`) — use only `pr` for the gap between icon and text since the icon should sit flush left inside the badge.

Apply the same changes to both the "New" badge (lines 103-130) and the "Returned" badge (lines 132-159).
  </action>
  <verify>
Run `cd /Users/cstalhem/projects/rss-reader/frontend && npx tsc --noEmit` to verify no type errors. Visually: start the dev server, go to Settings > Categories. Find a category with a "New" or "Returned" badge. When not hovering the row, the badge should show just "New"/"Returned" text with no extra left padding or reserved space. When hovering the row, the X icon should smoothly expand from the left at a readable 14px size with no vertical divider.
  </verify>
  <done>Badge chips show zero visual footprint for the X when not hovered. On hover, the X smoothly expands at 14px size with no divider. No reserved spacing when unhovered.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors in the frontend directory
2. `bun run build` succeeds
3. Cross-container drag shows placeholder in destination (not source)
4. Badge X icon has zero footprint when not hovered, smoothly reveals at readable size on hover
</verification>

<success_criteria>
- Drag placeholder appears in destination container during cross-container drags
- Drag placeholder does NOT appear in source container
- Badge dismiss X icon has no reserved space when not hovered
- Badge dismiss X icon is 14px and readable when revealed on hover
- No vertical divider between X and badge text
- TypeScript compilation passes
- Production build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/10-fix-category-drag-and-drop-placeholder-a/10-01-SUMMARY.md`
</output>
