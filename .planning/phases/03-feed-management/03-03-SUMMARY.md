---
phase: 03-feed-management
plan: 03
subsystem: feed-ui-interactions
tags: ["drag-reorder", "hover-actions", "swipe-actions", "delete-dialog", "inline-rename", "mark-all-read"]

dependency_graph:
  requires:
    - "03-02: feed list UI with sidebar and mobile drawer"
  provides:
    - "Interactive feed rows with drag-to-reorder"
    - "Desktop hover actions (delete, mark-all-read)"
    - "Mobile swipe actions"
    - "Inline rename on double-click/long-press"
    - "Delete confirmation dialog with article warning"
    - "Mark-all-read functionality per feed and from article list"
  affects:
    - "Sidebar: drag-and-drop reordering with dnd-kit"
    - "MobileSidebar: swipe-to-reveal actions"
    - "ArticleList: mark-all-read button in header"

tech_stack:
  added:
    - "@dnd-kit/core: Drag-and-drop context and sensors"
    - "@dnd-kit/sortable: Sortable list utilities"
    - "@dnd-kit/utilities: CSS transform helpers"
    - "react-swipeable: Swipe gesture handling"
  patterns:
    - "DndContext + SortableContext for feed reordering"
    - "useSortable hook for draggable feed rows"
    - "useSwipeable hook for mobile swipe actions"
    - "Ref merging for dnd-kit and react-swipeable"
    - "Optimistic updates for drag reordering"
    - "Confirmation dialogs for destructive actions"
    - "Inline editing with keyboard controls (Enter/Escape)"
    - "Long-press detection for mobile rename"

key_files:
  created:
    - path: "frontend/src/components/feed/FeedRow.tsx"
      purpose: "Reusable feed row component with drag handle, hover actions (desktop), swipe actions (mobile), and inline rename"
      lines: 256
    - path: "frontend/src/components/feed/DeleteFeedDialog.tsx"
      purpose: "Confirmation dialog for feed deletion with article warning"
      lines: 54
  modified:
    - path: "frontend/src/components/layout/Sidebar.tsx"
      changes: "Integrated dnd-kit for drag-to-reorder, replaced inline feed rows with FeedRow components, added delete dialog"
    - path: "frontend/src/components/layout/MobileSidebar.tsx"
      changes: "Replaced inline feed rows with FeedRow components (no drag), added delete dialog"
    - path: "frontend/src/components/article/ArticleList.tsx"
      changes: "Added mark-all-read button in header for selected feed view"
    - path: "frontend/package.json"
      changes: "Added @dnd-kit/* and react-swipeable dependencies"

decisions:
  - what: "Drag-to-reorder on desktop only"
    why: "Mobile drawer UX doesn't support drag well; swipe actions are more natural on mobile"
    alternatives: ["Enable drag on mobile", "Disable swipe on desktop"]
    chosen: "Desktop drag + mobile swipe"

  - what: "Activation constraint for drag (5px distance)"
    why: "Prevent accidental drags when clicking to select feed"
    impact: "Users must drag at least 5px before drag activates"

  - what: "Hover actions overlay unread badge"
    why: "Limited space in feed row; actions more important than badge during hover"
    implementation: "Use opacity transition to smoothly hide badge and show action buttons"

  - what: "Mobile swipe reveals action buttons behind row"
    why: "Standard mobile pattern (similar to email apps)"
    implementation: "translateX on row, absolute positioned action buttons on right"

  - what: "Inline rename via double-click (desktop) and long-press (mobile)"
    why: "Contextual editing without modal; different activation patterns for touch vs. mouse"
    implementation: "Input replaces text, Enter to save, Escape to cancel, blur to save"

  - what: "Delete confirmation with article count warning"
    why: "Prevent accidental deletion of feeds with many articles"
    implementation: "Dialog shows feed name in bold, warns about article deletion"

  - what: "Mark-all-read button only visible when feed selected and unread articles exist"
    why: "Button only relevant when viewing specific feed with unread items"
    implementation: "Conditional rendering based on selectedFeedId and articleCount"

metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 2
  files_modified: 5
  commits: 2
  completed_date: "2026-02-10"
---

# Phase 3 Plan 3: Feed Row Interactions Summary

**One-liner:** Interactive feed rows with drag-to-reorder (desktop), hover/swipe actions, inline rename, delete confirmation dialog, and mark-all-read functionality

## What Was Built

### Task 1: FeedRow Component with Drag-to-Reorder and Action Patterns
- **FeedRow.tsx**: Created comprehensive feed row component supporting:
  - **Drag handle** (LuGripVertical icon) using useSortable hook from @dnd-kit/sortable
  - **Desktop hover actions**: Mark-all-read (LuCheckCheck) and delete (LuTrash2) buttons appear on hover with smooth opacity transition
  - **Mobile swipe actions**: Swipe left reveals action buttons behind row, swipe right hides them
  - **Inline rename**: Double-click (desktop) or long-press (mobile) enables edit mode with Enter/Escape keyboard controls
  - **Selected state**: Accent background when feed is selected
  - **Drag state**: 50% opacity during drag, prevents interference with click selection
  - **Ref merging**: Combined dnd-kit setNodeRef and react-swipeable ref for compatibility

- **Sidebar.tsx**: Integrated dnd-kit drag-and-drop system:
  - DndContext with PointerSensor (5px activation constraint) and KeyboardSensor
  - SortableContext with verticalListSortingStrategy for feed list
  - handleDragEnd: Uses arrayMove to reorder feeds, calls useReorderFeeds mutation
  - Replaced inline feed rendering with FeedRow components
  - Added handlers for delete, mark-all-read, and rename operations

- **MobileSidebar.tsx**: Updated to use FeedRow components:
  - Same FeedRow component with isDraggable={false} (no drag handle)
  - Swipe actions enabled for mobile-first interaction pattern
  - Consistent handlers for all feed operations

### Task 2: Delete Confirmation Dialog and Mark-All-Read
- **DeleteFeedDialog.tsx**: Created confirmation dialog component:
  - Shows feed name in bold with article deletion warning
  - Cancel button (ghost variant) and Remove button (red colorPalette)
  - Centered dialog placement
  - Clean open/close handling via Feed | null prop pattern

- **Sidebar + MobileSidebar**: Integrated DeleteFeedDialog:
  - feedToDelete state tracks feed pending deletion
  - handleDeleteConfirm: Calls deleteFeed mutation, resets selection if deleted feed was selected
  - Dialog rendered at bottom of component tree

- **ArticleList.tsx**: Added mark-all-read button in header:
  - Button appears only when feed selected and unread articles exist
  - Placed between filter buttons and article count
  - Calls useMarkAllRead mutation for selected feed
  - Disabled state during mutation pending

## Deviations from Plan

None - plan executed exactly as written.

All planned functionality implemented:
- ✓ Drag-to-reorder with dnd-kit
- ✓ Desktop hover actions with smooth transitions
- ✓ Mobile swipe actions with translateX
- ✓ Inline rename via double-click and long-press
- ✓ Delete confirmation dialog with warning
- ✓ Mark-all-read per feed and from article list header
- ✓ Selection reset on feed deletion
- ✓ Proper cache invalidation for all mutations

## Testing Notes

All verification criteria met:
- ✓ TypeScript compiles with no errors
- ✓ Drag-to-reorder: Feeds reorder on drag, drag handle doesn't interfere with selection
- ✓ Hover actions (desktop): Buttons appear smoothly on hover, overlay unread badge
- ✓ Swipe actions (mobile): Swipe left reveals buttons, swipe right hides
- ✓ Delete confirmation: Dialog shows with warning, cancel preserves feed, confirm removes feed and articles
- ✓ Inline rename: Double-click enables edit, Enter saves, Escape cancels
- ✓ Mark all read: Per-feed button in action menu and in article list header
- ✓ Deleted feed selection reset: View returns to "All Articles" when deleting selected feed
- ✓ Cache invalidation: All mutations properly invalidate feeds and articles queries

## Integration Points

**Upstream dependencies:**
- 03-02: Feed list UI with Sidebar and MobileSidebar components
- useFeeds: Query hook for feed list
- useFeedMutations: Mutation hooks (useReorderFeeds, useDeleteFeed, useMarkAllRead, useUpdateFeed)

**Downstream consumers:**
- Feed management system now fully interactive
- Ready for 03-04: Add feed dialog and URL validation

**Data flow:**
- FeedRow emits events → Sidebar/MobileSidebar handlers → mutation hooks → API calls → cache invalidation
- Drag reorder: arrayMove → useReorderFeeds mutation → optimistic update with rollback on error
- Delete: DeleteFeedDialog confirm → useDeleteFeed mutation → selection reset if needed
- Mark all read: Button click → useMarkAllRead mutation → articles and feeds queries invalidated

## Performance Considerations

- **Optimistic updates**: useReorderFeeds uses onMutate for immediate UI feedback with rollback on error
- **Activation constraint**: 5px drag distance prevents accidental drags, improves perceived responsiveness
- **Smooth transitions**: 0.2s ease transitions for hover actions, swipe, and drag
- **Conditional rendering**: Action buttons only render when relevant (hover, swipe, feed selected)

## Self-Check: PASSED

All created files verified:
- ✓ frontend/src/components/feed/FeedRow.tsx
- ✓ frontend/src/components/feed/DeleteFeedDialog.tsx

All commits verified:
- ✓ 199aca9: feat(03-03): add FeedRow with drag-to-reorder, hover actions, and swipe
- ✓ af230b1: feat(03-03): add delete confirmation dialog and mark-all-read button
