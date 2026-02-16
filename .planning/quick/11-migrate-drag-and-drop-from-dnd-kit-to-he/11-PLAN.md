---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/layout/Sidebar.tsx
  - frontend/src/components/settings/FeedsSection.tsx
  - frontend/src/components/feed/FeedRow.tsx
  - frontend/src/components/settings/CategoriesSection.tsx
  - frontend/src/components/settings/CategoryGroupAccordion.tsx
  - frontend/src/components/settings/CategoryRow.tsx
  - frontend/package.json
autonomous: true
requirements: []

must_haves:
  truths:
    - "Feed list in sidebar can be reordered by dragging"
    - "Feed list in settings can be reordered by dragging"
    - "Categories can be dragged between groups and ungrouped section"
    - "Drop placeholder appears in destination container during drag"
    - "Drag visual feedback (opacity, background highlight) works in all contexts"
    - "No hydration mismatch errors in Next.js"
  artifacts:
    - path: "frontend/src/components/layout/Sidebar.tsx"
      provides: "Feed reorder DnD using hello-pangea/dnd"
      contains: "DragDropContext"
    - path: "frontend/src/components/settings/FeedsSection.tsx"
      provides: "Settings feed reorder DnD using hello-pangea/dnd"
      contains: "DragDropContext"
    - path: "frontend/src/components/feed/FeedRow.tsx"
      provides: "Draggable feed row with drag handle"
      contains: "Draggable"
    - path: "frontend/src/components/settings/CategoriesSection.tsx"
      provides: "Cross-container category DnD using hello-pangea/dnd"
      contains: "DragDropContext"
    - path: "frontend/src/components/settings/CategoryGroupAccordion.tsx"
      provides: "Droppable group accordion with placeholder"
      contains: "Droppable"
    - path: "frontend/src/components/settings/CategoryRow.tsx"
      provides: "Draggable category row with drag handle"
      contains: "Draggable"
  key_links:
    - from: "frontend/src/components/layout/Sidebar.tsx"
      to: "@hello-pangea/dnd"
      via: "DragDropContext + Droppable + onDragEnd"
      pattern: "DragDropContext"
    - from: "frontend/src/components/settings/CategoriesSection.tsx"
      to: "CategoryGroupAccordion.tsx"
      via: "Droppable containers nested inside DragDropContext"
      pattern: "Droppable.*droppableId"
    - from: "frontend/src/components/settings/CategoryRow.tsx"
      to: "@hello-pangea/dnd"
      via: "Draggable with dragHandleProps on grip icon"
      pattern: "provided\\.dragHandleProps"
---

<objective>
Migrate all drag-and-drop from @dnd-kit/core + @dnd-kit/sortable to @hello-pangea/dnd (maintained fork of react-beautiful-dnd).

Purpose: @hello-pangea/dnd provides superior list animations (no snap-back), built-in placeholders, and a cleaner API for the "items moving between lists" pattern used in category grouping. The current @dnd-kit/core v6 is legacy and has mediocre cross-container animation quality.

Output: All 6 DnD files migrated, @dnd-kit packages removed, @hello-pangea/dnd installed.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@frontend/src/components/layout/Sidebar.tsx
@frontend/src/components/settings/FeedsSection.tsx
@frontend/src/components/feed/FeedRow.tsx
@frontend/src/components/settings/CategoriesSection.tsx
@frontend/src/components/settings/CategoryGroupAccordion.tsx
@frontend/src/components/settings/CategoryRow.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install hello-pangea/dnd, migrate feed sortable DnD (Sidebar, FeedsSection, FeedRow)</name>
  <files>
    frontend/package.json
    frontend/src/components/layout/Sidebar.tsx
    frontend/src/components/settings/FeedsSection.tsx
    frontend/src/components/feed/FeedRow.tsx
  </files>
  <action>
1. Install @hello-pangea/dnd and remove @dnd-kit packages:
   ```
   cd frontend && bun add @hello-pangea/dnd && bun remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

2. **FeedRow.tsx** — Replace `useSortable` hook with `Draggable` render prop:
   - Remove imports: `useSortable` from `@dnd-kit/sortable`, `CSS` from `@dnd-kit/utilities`
   - Add new props: `index: number` and `draggableId: string` (hello-pangea needs both)
   - Wrap the existing Box in `<Draggable draggableId={String(feed.id)} index={index}>` with render prop `(provided, snapshot)`
   - Apply `ref={provided.innerRef}`, `{...provided.draggableProps}` on the outer Box (replaces `setNodeRef` + `style`)
   - Apply `{...provided.dragHandleProps}` on the drag handle Box (replaces `{...attributes} {...listeners}`)
   - Use `snapshot.isDragging` for opacity (replaces the hook's `isDragging`)
   - Remove the manual `style` object with `CSS.Transform.toString(transform)` — hello-pangea handles positioning internally
   - Keep the swipeable ref merge: merge `provided.innerRef` with `swipeHandlers.ref` using a callback ref
   - The `isDraggable` prop logic stays the same; when `isDraggable` is false, wrap in a plain div instead of Draggable (or use `isDragDisabled={!isDraggable}` on the Draggable)

3. **Sidebar.tsx** — Replace `DndContext` + `SortableContext` with `DragDropContext` + `Droppable`:
   - Remove all `@dnd-kit/core` and `@dnd-kit/sortable` imports
   - Import `DragDropContext, Droppable, DropResult` from `@hello-pangea/dnd`
   - Remove `sensors` setup (`useSensors`, `useSensor`, `PointerSensor`, `KeyboardSensor`)
   - Replace `handleDragEnd` to accept `DropResult` instead of `DragEndEvent`:
     ```ts
     const handleDragEnd = (result: DropResult) => {
       const { source, destination } = result;
       if (!destination || !feeds) return;
       if (source.index === destination.index) return;
       const reorderedFeeds = Array.from(feeds);
       const [moved] = reorderedFeeds.splice(source.index, 1);
       reorderedFeeds.splice(destination.index, 0, moved);
       reorderFeeds.mutate(reorderedFeeds.map((f) => f.id));
     };
     ```
   - Replace `<DndContext>` + `<SortableContext>` with:
     ```tsx
     <DragDropContext onDragEnd={handleDragEnd}>
       <Droppable droppableId="sidebar-feeds">
         {(provided) => (
           <div ref={provided.innerRef} {...provided.droppableProps}>
             {feeds.map((feed, index) => (
               <FeedRow key={feed.id} feed={feed} index={index} ... />
             ))}
             {provided.placeholder}
           </div>
         )}
       </Droppable>
     </DragDropContext>
     ```
   - Pass `index` prop to each FeedRow

4. **FeedsSection.tsx** — Same pattern as Sidebar:
   - Remove all `@dnd-kit` imports, `sensors`, `CSS` usage
   - The inline `SortableFeedRow` component: convert from `useSortable` hook to `Draggable` render prop pattern
   - Replace `DndContext` + `SortableContext` with `DragDropContext` + `Droppable`
   - Update `handleDragEnd` to use `DropResult` with `source.index` / `destination.index`
   - Include `{provided.placeholder}` inside the Droppable
   - Pass `index` to each SortableFeedRow

**SSR hydration safety:** These components already have `"use client"` and feeds are loaded via TanStack Query (renders loading state on server, data on client), so no additional SSR workaround needed for the feed lists.
  </action>
  <verify>
    Run `cd frontend && bun run build` — no TypeScript errors, no build errors. Confirm no remaining imports from `@dnd-kit` in these 3 files: `grep -r "@dnd-kit" frontend/src/components/layout/Sidebar.tsx frontend/src/components/settings/FeedsSection.tsx frontend/src/components/feed/FeedRow.tsx` returns nothing.
  </verify>
  <done>
    Feed reorder drag-and-drop works in both Sidebar and FeedsSection using @hello-pangea/dnd. FeedRow uses Draggable with drag handle props. No @dnd-kit imports remain in these files. Build passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate category cross-container DnD (CategoriesSection, CategoryGroupAccordion, CategoryRow)</name>
  <files>
    frontend/src/components/settings/CategoriesSection.tsx
    frontend/src/components/settings/CategoryGroupAccordion.tsx
    frontend/src/components/settings/CategoryRow.tsx
  </files>
  <action>
1. **CategoryRow.tsx** — Replace `useDraggable` with `Draggable` render prop:
   - Remove `useDraggable` import from `@dnd-kit/core`
   - Add props: `index: number` (required by Draggable, must be consecutive 0-based within each container)
   - Wrap the outer Flex in `<Draggable draggableId={category} index={index}>` with `(provided, snapshot)` render prop
   - Apply `ref={provided.innerRef}`, `{...provided.draggableProps}` on the outer Flex (replaces `ref={setNodeRef}`)
   - Apply `{...provided.dragHandleProps}` on the grip icon Flex (replaces `{...attributes} {...listeners}`)
   - Use `snapshot.isDragging` for opacity (replaces `isDragging` from hook)
   - Remove `setNodeRef`, `attributes`, `listeners`, `isDragging` destructuring

2. **CategoryGroupAccordion.tsx** — Replace `useDroppable` with `Droppable` render prop:
   - Remove `useDroppable` import from `@dnd-kit/core`
   - Remove `const { setNodeRef, isOver } = useDroppable({ id: group.id })`
   - Wrap `<Accordion.Item>` with `<Droppable droppableId={group.id} type="CATEGORY">`:
     ```tsx
     <Droppable droppableId={group.id} type="CATEGORY">
       {(provided, snapshot) => (
         <Accordion.Item
           value={group.id}
           ref={provided.innerRef}
           {...provided.droppableProps}
           bg={snapshot.isDraggingOver ? "bg.muted" : undefined}
           transition="background 0.15s"
         >
           {/* ... existing header/content ... */}
           <Accordion.ItemContent>
             <Accordion.ItemBody px={4} pb={3} pt={1}>
               <Stack gap={1}>
                 {sortedCategories.map((category, index) => (
                   <CategoryRow key={category} category={category} index={index} ... />
                 ))}
               </Stack>
             </Accordion.ItemBody>
           </Accordion.ItemContent>
           {provided.placeholder}
           {/* Custom visual placeholder for cross-container moves */}
           {snapshot.isDraggingOver && activeId && sourceContainer !== group.id && !group.categories.includes(activeId) && (
             <Box ...>{/* existing placeholder markup */}</Box>
           )}
         </Accordion.Item>
       )}
     </Droppable>
     ```
   - Use `snapshot.isDraggingOver` instead of `isOver` for background highlight
   - Keep the manual visual placeholder (the dashed-border box) for cross-container feedback — `provided.placeholder` handles spacing, the visual placeholder is custom UX
   - **Critical:** `provided.innerRef` goes on `Accordion.Item` which is always visible (even when collapsed) — this matches the current `setNodeRef` placement on `Accordion.Item` per the Quick-10 fix
   - Pass `index` to each CategoryRow (consecutive 0-based within the sorted categories list)

3. **CategoriesSection.tsx** — Replace `DndContext` + `DragOverlay` with `DragDropContext`:
   - Remove all `@dnd-kit/core` imports: `DndContext`, `DragOverlay`, `DragStartEvent`, `DragOverEvent`, `DragEndEvent`, `pointerWithin`, `PointerSensor`, `useSensor`, `useSensors`, `useDroppable`
   - Import `DragDropContext, Droppable, DropResult, DragStart, DragUpdate` from `@hello-pangea/dnd`
   - Remove `sensors` setup
   - **UngroupedDroppable component** — rewrite to use `Droppable`:
     ```tsx
     function UngroupedDroppable({ items, children, activeId, sourceContainer }: { ... }) {
       return (
         <Droppable droppableId="ungrouped" type="CATEGORY">
           {(provided, snapshot) => (
             <Box
               ref={provided.innerRef}
               {...provided.droppableProps}
               bg={snapshot.isDraggingOver ? "bg.muted" : undefined}
               borderRadius="sm"
               transition="background 0.15s"
               p={snapshot.isDraggingOver ? 1 : 0}
             >
               {children}
               {provided.placeholder}
               {/* Custom visual placeholder */}
               {snapshot.isDraggingOver && activeId && sourceContainer !== "ungrouped" && !items.includes(activeId) && (
                 <Box p={2} mt={1} bg="bg.muted" borderRadius="sm" borderWidth="1px" borderStyle="dashed" borderColor="border.subtle" opacity={0.5}>
                   <Text fontSize="sm" color="fg.muted">{toTitleCase(activeId)}</Text>
                 </Box>
               )}
             </Box>
           )}
         </Droppable>
       );
     }
     ```
   - **handleDragStart** — update to use `DragStart` type:
     ```ts
     const handleDragStart = (start: DragStart) => {
       const draggedCategory = start.draggableId;
       setActiveId(draggedCategory);
       setSourceContainer(findContainer(draggedCategory));
     };
     ```
   - **handleDragEnd** — update to use `DropResult`:
     ```ts
     const handleDragEnd = (result: DropResult) => {
       setActiveId(null);
       setSourceContainer(null);
       const { source, destination, draggableId } = result;
       if (!destination || !categoryGroups) return;
       const sourceContainerId = source.droppableId;
       const destContainerId = destination.droppableId;
       if (sourceContainerId === destContainerId) return;
       // Build updated groups (same logic, just using droppableIds instead of active/over)
       const updatedGroups = categoryGroups.groups.map((g) => {
         let cats = [...g.categories];
         if (g.id === sourceContainerId) cats = cats.filter((c) => c !== draggableId);
         if (g.id === destContainerId && !cats.includes(draggableId)) cats.push(draggableId);
         return { ...g, categories: cats };
       });
       saveGroups({ ...categoryGroups, groups: updatedGroups });
     };
     ```
   - **Remove `handleDragOver`** — no longer needed (no DragOverlay to position)
   - **Remove `<DragOverlay>`** entirely — hello-pangea/dnd handles the dragged item appearance via `snapshot.isDragging` on the Draggable. The original item stays in place with reduced opacity during drag.
   - Replace `<DndContext ...>` with `<DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>`
   - Remove `activeCategoryDisplay` variable (was only used by DragOverlay)
   - All `type="CATEGORY"` on Droppables ensures categories only interact with category droppables (not feed droppables if they ever share a page)

**SSR hydration note:** The CategoriesSection renders inside the settings panel which loads data via TanStack Query. The loading skeleton shows on initial render, and the DnD components only render after data loads — no hydration mismatch risk. If any issues arise during testing, apply the `useState(false)` + `useEffect(() => setMounted(true))` pattern with skeleton fallback.
  </action>
  <verify>
    Run `cd frontend && bun run build` — no TypeScript errors. Confirm no remaining @dnd-kit imports anywhere: `grep -r "@dnd-kit" frontend/src/` returns nothing. Confirm @dnd-kit packages are gone from package.json: `grep "dnd-kit" frontend/package.json` returns nothing.
  </verify>
  <done>
    Category cross-container drag-and-drop works using @hello-pangea/dnd. Categories can be dragged between groups and ungrouped. Drop placeholder appears in destination. DragOverlay removed (hello-pangea handles it). All @dnd-kit packages fully removed from the project. `bun run build` passes clean.
  </done>
</task>

</tasks>

<verification>
1. `cd frontend && bun run build` passes with no errors
2. `grep -r "@dnd-kit" frontend/src/` returns no results (complete removal)
3. `grep "dnd-kit" frontend/package.json` returns no results
4. `grep "@hello-pangea/dnd" frontend/package.json` returns a match (package installed)
5. All 6 migrated files import from `@hello-pangea/dnd` only
</verification>

<success_criteria>
- All drag-and-drop functionality migrated from @dnd-kit to @hello-pangea/dnd
- Feed reorder works in Sidebar and FeedsSection via Droppable + Draggable
- Category cross-container DnD works between groups and ungrouped section
- Custom visual drop placeholders preserved for cross-container moves
- DragOverlay removed (hello-pangea manages dragged item appearance)
- No @dnd-kit packages remain in package.json or source imports
- Production build passes clean
</success_criteria>

<output>
After completion, create `.planning/quick/11-migrate-drag-and-drop-from-dnd-kit-to-he/11-SUMMARY.md`
</output>
