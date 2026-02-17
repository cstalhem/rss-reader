---
status: diagnosed
trigger: "ungroup-via-dnd"
created: 2026-02-17T10:00:00Z
updated: 2026-02-17T10:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - CategoryChildRow droppable zones intercept drops before they reach ungroup zone
test: Reviewed CategoryChildRow implementation
expecting: Root cause identified
next_action: Document root cause and files involved

## Symptoms

expected: Dragging a child to the ungroup zone releases it to root level
actual: User reported: "Fail. It's not possible to ungroup via dnd"
errors: None reported
reproduction: Test 6 in UAT round 2 — drag a child category from inside a parent toward the "Drop here to ungroup" zone below the tree
started: Plan 08.1-06 added an explicit ungroup drop zone. The zone exists but drops don't register on it.

## Eliminated

## Evidence

- timestamp: 2026-02-17T10:05:00Z
  checked: CategoriesSection.tsx ungroup zone setup
  found: Ungroup zone uses useDroppable with id "ungroup-zone" (line 229-232), conditionally rendered when activeId is set (line 468), and handleDragEnd has explicit case for overId === "ungroup-zone" (line 256)
  implication: The ungroup zone is properly configured as a droppable. The bug is likely in collision detection or another droppable intercepting the drop.

- timestamp: 2026-02-17T10:10:00Z
  checked: CategoryChildRow.tsx droppable configuration
  found: CategoryChildRow uses BOTH useSortable (line 54-64) AND useDroppable (line 66-70) with id "drop:${category}" on the same element. Every ungrouped category at the bottom of the tree is a droppable zone.
  implication: When dragging a child category downward toward the ungroup zone, the pointer passes over ungrouped CategoryChildRow elements first. These rows intercept the drop event before it reaches the ungroup zone below.

- timestamp: 2026-02-17T10:12:00Z
  checked: DndContext collision detection configuration
  found: No collisionDetection prop specified in CategoriesSection DndContext (line 444-450). Default collision detection (rectIntersection) is used.
  implication: Default collision detection doesn't prioritize the ungroup zone over CategoryChildRow droppables. First intersecting droppable wins, which is always an ungrouped category row above the ungroup zone.

## Resolution

root_cause: The ungroup drop zone is positioned below the list of ungrouped categories. When dragging a child category downward to ungroup it, the pointer passes over ungrouped CategoryChildRow elements which have droppable zones (id "drop:${category}"). These category row droppables intercept the drop event before it reaches the ungroup zone. The default collision detection algorithm (rectIntersection) returns the first intersecting droppable, which is always a category row above the ungroup zone, never the zone itself.

fix:
verification:
files_changed: []
