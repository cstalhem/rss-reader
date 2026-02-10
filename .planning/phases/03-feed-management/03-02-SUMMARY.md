---
phase: 03-feed-management
plan: 02
subsystem: frontend-feed-ui
tags: [ui, feeds, sidebar, mobile, dialog]
dependency-graph:
  requires: [03-01-feed-crud-backend]
  provides: [feed-list-ui, feed-navigation, add-feed-dialog, mobile-sidebar]
  affects: [article-filtering, sidebar-state]
tech-stack:
  added: [TanStack Query for feeds, localStorage for UI state, Chakra Drawer for mobile]
  patterns: [optimistic updates for reorder, render props for state passing, localStorage persistence]
key-files:
  created:
    - frontend/src/hooks/useFeeds.ts
    - frontend/src/hooks/useFeedMutations.ts
    - frontend/src/hooks/useLocalStorage.ts
    - frontend/src/components/layout/MobileSidebar.tsx
    - frontend/src/components/feed/AddFeedDialog.tsx
    - frontend/src/components/feed/EmptyFeedState.tsx
  modified:
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useArticles.ts
    - frontend/src/components/layout/AppShell.tsx
    - frontend/src/components/layout/Header.tsx
    - frontend/src/components/layout/Sidebar.tsx
    - frontend/src/components/article/ArticleList.tsx
    - frontend/src/app/page.tsx
decisions:
  - title: "Render prop pattern for selectedFeedId passing"
    rationale: "Allows AppShell to manage feed selection state while passing it down to ArticleList without prop drilling"
    alternatives: "Context API (overkill), direct prop passing (requires intermediate components)"
  - title: "localStorage for sidebar collapse state"
    rationale: "Persists user preference across sessions without backend involvement"
  - title: "Optimistic updates for feed reorder"
    rationale: "Immediate UI feedback for drag operations, with rollback on error"
  - title: "Three-step add feed dialog flow"
    rationale: "url → loading → success provides clear feedback and enables rename without closing dialog"
  - title: "Chakra Drawer for mobile sidebar"
    rationale: "Native Chakra component with responsive size props, matches desktop sidebar content"
metrics:
  duration: 5
  tasks-completed: 3
  files-created: 6
  files-modified: 8
  completed-at: 2026-02-10
---

# Phase 03 Plan 02: Feed List UI & Mobile Navigation Summary

**Built frontend data layer, sidebar with feed list, mobile drawer, and add feed dialog with URL validation and rename flow.**

## Tasks Completed

### Task 1: Frontend data layer — types, API client, hooks
**Commit:** `181e85f`

- Updated `Feed` interface to include `display_order` and `unread_count` fields
- Added feed API client functions: `fetchFeeds`, `createFeed`, `deleteFeed`, `updateFeed`, `reorderFeeds`, `markAllFeedRead`
- Updated `fetchArticles` to accept optional `feed_id` parameter for filtering
- Created `useFeeds` hook using TanStack Query for fetching feed list
- Created `useFeedMutations` hook with:
  - `useAddFeed` — invalidates feeds and articles on success
  - `useDeleteFeed` — invalidates feeds and articles on success
  - `useUpdateFeed` — invalidates feeds on success
  - `useReorderFeeds` — uses optimistic updates with rollback on error
  - `useMarkAllRead` — invalidates feeds and articles on success
- Created `useLocalStorage<T>` hook for SSR-safe localStorage persistence
- Updated `useArticles` to accept optional `feedId` parameter and include it in query key

**Key files:** types.ts, api.ts, useFeeds.ts, useFeedMutations.ts, useLocalStorage.ts, useArticles.ts

### Task 2: Sidebar with feed list, mobile drawer, and AppShell integration
**Commit:** `a0b9b17`

- Completely rebuilt `Sidebar` component:
  - Shows "All Articles" row with aggregate unread count (sum of all feeds)
  - Renders feed list below with per-feed unread badges
  - Highlights selected feed with accent background and left border indicator
  - Includes '+' button in header to open add feed dialog
  - Shows empty state when no feeds exist
- Created `MobileSidebar` component using Chakra `Drawer`:
  - Opens from left on mobile (full width on base, xs on sm+)
  - Shares feed list rendering with desktop sidebar
  - Closes automatically after feed selection
  - Includes '+' button and close trigger in header
- Updated `Header` to add hamburger menu button (visible on base, hidden on md+)
- Created `EmptyFeedState` component with friendly prompt to add first feed
- Updated `AppShell`:
  - Replaced `useState` for sidebar collapse with `useLocalStorage` for persistence
  - Added `selectedFeedId` state (null = "All Articles")
  - Added `isMobileSidebarOpen` state for drawer
  - Added `isAddDialogOpen` state for feed dialog
  - Uses render prop pattern to pass `selectedFeedId` to children
- Updated `ArticleList` to accept `selectedFeedId` prop and filter articles accordingly
- Updated `page.tsx` to use render prop pattern

**Key files:** Sidebar.tsx, MobileSidebar.tsx, AppShell.tsx, Header.tsx, EmptyFeedState.tsx, ArticleList.tsx, page.tsx

### Task 3: Add Feed Dialog with URL validation and rename flow
**Commit:** `092562b`

- Created `AddFeedDialog` component with three-step state machine:
  1. **url step:** Input field with URL validation (require http/https prefix)
  2. **loading step:** Spinner with "Fetching feed..." status message
  3. **success step:** Shows article count, displays feed title in editable input, "Save Name" button (if edited), "Add Another" and "Done" buttons
- Implemented URL validation:
  - Require non-empty URL
  - Require http:// or https:// prefix
  - Show inline error messages below input field
- Error handling for common API failures:
  - "Feed already exists"
  - "URL is not a valid RSS feed"
  - "Failed to fetch URL"
  - Generic fallback error
- Dialog stays open after successful add to enable adding multiple feeds
- "Add Another" button resets to url step with clean state
- Dialog resets all state on close via `useEffect` watching `isOpen`
- Wired dialog to `AppShell` with `isAddDialogOpen` state
- '+' button in sidebar header and mobile drawer opens dialog

**Key files:** AddFeedDialog.tsx, AppShell.tsx

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

TypeScript compilation: ✅ No errors

All features implemented per spec:
- ✅ Sidebar shows feed list with unread counts
- ✅ "All Articles" shows aggregate count and filters to all articles
- ✅ Clicking a feed filters article list to that feed
- ✅ Selected feed has accent highlight with left border
- ✅ Sidebar collapse persists via localStorage
- ✅ Mobile hamburger menu opens drawer
- ✅ Mobile drawer closes on feed selection
- ✅ Add feed dialog: url → validate → spinner → success → rename → add another
- ✅ Dialog shows inline errors for invalid URLs
- ✅ Dialog resets on close
- ✅ Empty sidebar shows "No feeds yet" message

## Self-Check: PASSED

**Created files verified:**
```
FOUND: frontend/src/hooks/useFeeds.ts
FOUND: frontend/src/hooks/useFeedMutations.ts
FOUND: frontend/src/hooks/useLocalStorage.ts
FOUND: frontend/src/components/layout/MobileSidebar.tsx
FOUND: frontend/src/components/feed/AddFeedDialog.tsx
FOUND: frontend/src/components/feed/EmptyFeedState.tsx
```

**Commits verified:**
```
FOUND: 181e85f (Task 1: Frontend data layer)
FOUND: a0b9b17 (Task 2: Sidebar and mobile drawer)
FOUND: 092562b (Task 3: Add feed dialog)
```

**Modified files verified:**
```
FOUND: frontend/src/lib/types.ts (Feed interface updated)
FOUND: frontend/src/lib/api.ts (feed API functions added)
FOUND: frontend/src/hooks/useArticles.ts (feedId parameter added)
FOUND: frontend/src/components/layout/AppShell.tsx (state management and dialog)
FOUND: frontend/src/components/layout/Header.tsx (hamburger menu)
FOUND: frontend/src/components/layout/Sidebar.tsx (complete rebuild)
FOUND: frontend/src/components/article/ArticleList.tsx (selectedFeedId prop)
FOUND: frontend/src/app/page.tsx (render prop pattern)
```

## Notes

- Feed data layer follows same TanStack Query patterns as article data layer (30s staleTime)
- Optimistic updates for `useReorderFeeds` provide immediate feedback for future drag-to-reorder feature
- Render prop pattern in AppShell keeps state management centralized while avoiding prop drilling
- Mobile drawer uses Chakra's responsive size prop (full on base, xs on sm+) for optimal UX
- Dialog's "Add Another" workflow encourages batch feed imports without repetitive open/close cycles
- localStorage persistence for sidebar collapse provides seamless UX across sessions
- Empty state prompts user to add first feed, reducing confusion for new users
- Left border indicator on selected feed provides stronger visual affordance than background alone
- All Chakra UI v3 patterns followed (dot notation for Dialog/Drawer, truncate instead of isTruncated)

## Dependencies

**Requires:**
- 03-01 backend feed CRUD endpoints (GET /api/feeds, POST /api/feeds, etc.)

**Provides:**
- Feed list UI with navigation
- Add feed dialog
- Mobile sidebar drawer
- localStorage-persisted sidebar state

**Affects:**
- Article filtering (now supports feed-specific views)
- Sidebar navigation patterns
