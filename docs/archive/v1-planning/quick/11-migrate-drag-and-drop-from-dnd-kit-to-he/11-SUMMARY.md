---
phase: quick-11
plan: 01
subsystem: ui
tags: [hello-pangea-dnd, drag-and-drop, react, migration]

# Dependency graph
requires:
  - phase: 08-category-grouping
    provides: "Cross-container category DnD with @dnd-kit/core"
provides:
  - "All DnD migrated from @dnd-kit to @hello-pangea/dnd"
  - "Feed reorder DnD in Sidebar and FeedsSection"
  - "Category cross-container DnD between groups and ungrouped"
affects: [frontend-dnd, settings, sidebar]

# Tech tracking
tech-stack:
  added: ["@hello-pangea/dnd@18.0.1"]
  removed: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"]
  patterns: ["Draggable/Droppable render prop pattern", "DragDropContext replacing DndContext+SortableContext"]

key-files:
  modified:
    - frontend/src/components/layout/Sidebar.tsx
    - frontend/src/components/settings/FeedsSection.tsx
    - frontend/src/components/feed/FeedRow.tsx
    - frontend/src/components/settings/CategoriesSection.tsx
    - frontend/src/components/settings/CategoryGroupAccordion.tsx
    - frontend/src/components/settings/CategoryRow.tsx
    - frontend/package.json

key-decisions:
  - "Replaced useSortable/useDraggable hooks with Draggable render prop (provided, snapshot)"
  - "Replaced useDroppable hook with Droppable render prop (provided, snapshot)"
  - "Removed DragOverlay entirely -- hello-pangea handles drag appearance via snapshot.isDragging opacity"
  - "Used type='CATEGORY' on category Droppables for type isolation from feed Droppables"

patterns-established:
  - "Draggable render prop: (provided, snapshot) => JSX with provided.innerRef, provided.draggableProps, provided.dragHandleProps"
  - "Droppable render prop: (provided, snapshot) => JSX with provided.innerRef, provided.droppableProps, provided.placeholder"
  - "snapshot.isDragging for drag opacity, snapshot.isDraggingOver for drop target highlight"

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-02-16
---

# Quick Task 11: Migrate DnD from @dnd-kit to @hello-pangea/dnd Summary

**Complete migration of all drag-and-drop from @dnd-kit/core+sortable to @hello-pangea/dnd across 6 component files**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-16T22:36:05Z
- **Completed:** 2026-02-16T22:46:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Migrated feed reorder DnD (Sidebar, FeedsSection, FeedRow) from useSortable to Draggable/Droppable
- Migrated category cross-container DnD (CategoriesSection, CategoryGroupAccordion, CategoryRow) from DndContext/useDroppable/useDraggable to DragDropContext/Droppable/Draggable
- Removed DragOverlay -- hello-pangea manages dragged item appearance via snapshot.isDragging
- All @dnd-kit packages removed from package.json and no imports remain in source
- Production build passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Install hello-pangea/dnd, migrate feed sortable DnD** - `94d0176` (feat)
2. **Task 2: Migrate category cross-container DnD** - `75b5cf7` (feat)

## Files Created/Modified
- `frontend/package.json` - Replaced @dnd-kit deps with @hello-pangea/dnd
- `frontend/src/components/feed/FeedRow.tsx` - Draggable render prop replacing useSortable
- `frontend/src/components/layout/Sidebar.tsx` - DragDropContext + Droppable replacing DndContext + SortableContext
- `frontend/src/components/settings/FeedsSection.tsx` - DragDropContext + Droppable + inline Draggable for SortableFeedRow
- `frontend/src/components/settings/CategoriesSection.tsx` - DragDropContext replacing DndContext, removed DragOverlay, UngroupedDroppable uses Droppable render prop
- `frontend/src/components/settings/CategoryGroupAccordion.tsx` - Droppable render prop replacing useDroppable
- `frontend/src/components/settings/CategoryRow.tsx` - Draggable render prop replacing useDraggable

## Decisions Made
- Used Draggable render prop pattern rather than isDragDisabled for non-draggable FeedRow -- renders plain content function when isDraggable is false
- Kept custom visual placeholder boxes for cross-container moves (dashed border preview) alongside provided.placeholder which handles spacing
- Used type="CATEGORY" on all category Droppables for type isolation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DnD migration complete, all functionality preserved
- Pending todo #4 (evaluate migrating DnD) in STATE.md can be removed

---
*Quick Task: 11*
*Completed: 2026-02-16*
