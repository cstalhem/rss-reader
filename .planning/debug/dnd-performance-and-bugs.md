---
status: diagnosed
trigger: "dnd-performance-and-bugs

**Summary:** Drag-and-drop is still laggy with visual bugs — user wants to migrate to @dnd-kit/react"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:45:00Z
---

## Current Focus

hypothesis: Need to understand current implementation limitations and whether @dnd-kit/react provides architectural improvements
test: Research @dnd-kit/react API and compare with current implementation, analyze codebase for performance bottlenecks
expecting: Clear understanding of root cause and migration feasibility
next_action: Read current implementation files and research @dnd-kit/react

## Symptoms

expected: Drag-and-drop is smooth, responsive, and visually correct
actual: User reported: "Drag is still not good and there are still visual bugs in several places. We probably need to change the library. We should test the dnd-kit/react but need to research the implementation properly first."
errors: None reported
reproduction: Test 5 in UAT round 2 — drag any category in the Settings Categories tree
started: Persistent issue across multiple rounds. Project has tried @hello-pangea/dnd (reverted — collapsed accordion drop targets), @dnd-kit (current — performance issues, visual bugs), now considering @dnd-kit/react (newer rewrite).

## Eliminated

## Evidence

- timestamp: 2026-02-17T00:10:00Z
  checked: Current implementation uses @dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0
  found: CategoryChildRow uses BOTH useSortable AND useDroppable on the same element, combines refs manually. CategoryParentRow uses only useDroppable. DndContext in CategoriesSection uses PointerSensor with 5px activation distance.
  implication: Multiple hooks on same element + ref combining may cause re-render overhead

- timestamp: 2026-02-17T00:15:00Z
  checked: GitHub issues for @dnd-kit/core performance problems
  found: Issue #898 reports "Major performance issues with sortable tree example" — every row re-renders when dragging one item due to dragHandle prop changes. Issue #389 reports "Unnecessary rerenders cause poor performance". Issue #1069 reports dragStart delay with many items.
  implication: Known performance issues with tree structures in @dnd-kit/core, especially with re-renders

- timestamp: 2026-02-17T00:20:00Z
  checked: @dnd-kit/react status and architecture
  found: @dnd-kit/react is at v0.3.0 (published very recently), represents complete rewrite with framework-agnostic core (@dnd-kit/abstract) and DOM layer (@dnd-kit/dom). GitHub discussion #1842 asks about production readiness — community unsure if ready for production.
  implication: @dnd-kit/react is still experimental (pre-1.0), not production-ready yet

- timestamp: 2026-02-17T00:25:00Z
  checked: @dnd-kit/react tree support and API differences
  found: API is simpler — uses DragDropProvider, useDraggable, useDroppable (no separate sortable package). No tree-specific documentation found yet. dnd-kit-sortable-tree package exists for @dnd-kit/core but doesn't support @dnd-kit/react.
  implication: Would require custom tree implementation with @dnd-kit/react, unclear if it solves performance issues

- timestamp: 2026-02-17T00:30:00Z
  checked: CategoryChildRow implementation details
  found: CategoryChildRow combines useSortable (for dragging) + useDroppable (for drop targets) on same element with manual ref combining (setSortableRef + setDroppableRef). Also wrapped in SwipeableRow for mobile gestures. Uses CSS.Transform.toString for visual feedback.
  implication: Dual hook usage likely causing excessive re-renders on every drag event. SwipeableRow adds another layer of event handling.

- timestamp: 2026-02-17T00:35:00Z
  checked: Visual bugs mentioned in UAT
  found: Code shows CategoryParentRow has drop preview (lines 153-171) that renders beneath parent when isOver. CategoryChildRow has tree connector lines (_before/_after pseudo-elements) that are static. No collision detection strategy specified in DndContext.
  implication: Drop preview positioning might cause visual glitches. Default collision detection may not be optimal for tree structure.

- timestamp: 2026-02-17T00:40:00Z
  checked: Collision detection configuration in CategoriesSection
  found: DndContext in CategoriesSection.tsx (lines 444-449) does NOT specify collisionDetection prop — uses default. FeedsSection.tsx uses closestCenter for comparison.
  implication: Default collision detection not optimized for tree structures with nested drop zones. Can cause incorrect drop target identification.

## Resolution

root_cause: Multiple compounding issues causing performance degradation and visual glitches:

1. **Re-render overhead from dual hooks**: CategoryChildRow uses BOTH useSortable and useDroppable on the same element with manual ref combining. Each drag event triggers updates to both hooks, causing every row to re-render twice per drag move. This is a known issue in @dnd-kit/core #898 where "every row gets re-rendered when dragging one item because dragHandle prop changes."

2. **Missing collision detection optimization**: DndContext uses default collision detection instead of tree-optimized strategy (e.g., closestCenter, pointerWithin). With overlapping drop zones (parent rows + child rows + ungroup zone), default detection struggles to identify correct drop targets, causing visual flickering as isOver state rapidly changes.

3. **Visual bugs from layering conflicts**: CategoryParentRow's drop preview (absolute positioned Box at bottom:-8px, lines 153-171) lacks z-index and can render beneath other elements. Tree connector pseudo-elements (_before/_after) in CategoryTree.tsx have fixed positioning that doesn't account for drag overlay transforms.

4. **@dnd-kit/react migration not viable**: @dnd-kit/react v0.3.0 is pre-production with no stable release timeline (GitHub discussion #1842). No tree/nested structure examples exist. The architectural rewrite (framework-agnostic core) doesn't solve the fundamental re-render problem — it's a different abstraction layer, not a performance fix. Migration would require complete reimplementation with no guarantee of improvement.

**Recommendation**: Optimize current @dnd-kit/core implementation rather than migrate. Specific fixes: (1) Use React.memo + stable callbacks to prevent unnecessary re-renders, (2) Add closestCenter or custom collision detection, (3) Fix drop preview z-index and positioning, (4) Consider separating sortable/droppable concerns (make children sortable OR droppable, not both).

fix:
verification:
files_changed: []
