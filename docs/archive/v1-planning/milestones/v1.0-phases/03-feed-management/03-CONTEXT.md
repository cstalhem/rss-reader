# Phase 3: Feed Management - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage their feed subscriptions through the UI. Add new RSS feeds by URL and remove existing ones. Feed list lives in the sidebar as a navigable, filterable list. This phase also makes the sidebar collapsible and responsive.

</domain>

<decisions>
## Implementation Decisions

### Sidebar & navigation
- Feeds appear as a clickable list in the sidebar below "All Articles"
- Clicking a feed filters the article list to that feed only
- Selected feed row gets accent highlight (article list header unchanged)
- "All Articles" shows aggregate unread count; each feed shows per-feed unread count
- Sidebar is collapsible on desktop — completely hidden when collapsed, toggle button to restore
- On mobile: sidebar becomes a hamburger menu that opens as an overlay
- Feed order is user-customizable via drag-to-reorder (persisted)

### Add feed experience
- '+' button in the sidebar header opens a centered dialog/modal
- Dialog contains URL input field — submit triggers immediate backend fetch
- If URL is not a valid RSS feed: show error inline in dialog (no auto-discovery)
- On success: spinner + status text ("Fetching feed..." then "Found X articles")
- After successful add: name input enables and auto-populates from feed title — user can rename
- Dialog stays open after add (input cleared) for adding more feeds; "Done" button to close

### Feed list & removal
- Desktop: hover over feed row reveals action buttons (remove, mark all read)
- Mobile: swipe or long-press to reveal action buttons
- Removal requires confirmation dialog: "Remove [Feed Name]? This will delete all articles from this feed."
- Articles are deleted from database on feed removal
- Inline rename via double-click (desktop) or long-press (mobile) on feed name
- "Mark all as read" available per-feed (hover/swipe action) and globally (article list header button)

### Feedback & loading states
- Add dialog: spinner + status text during fetch
- Error messages shown inline in add dialog — user can correct and retry
- Empty sidebar (no feeds): friendly message like "No feeds yet — tap + to add your first feed"
- Background refresh is silent — no visual indicator on feed rows during scheduled refresh

### Claude's Discretion
- Exact dialog layout and sizing
- Drag-to-reorder implementation approach
- Sidebar collapse animation style
- Hamburger menu icon placement and animation
- Toast vs inline for success confirmation after add

</decisions>

<specifics>
## Specific Ideas

- Add dialog flow: URL input → submit → spinner → success → name field enables with auto-populated title → user can rename → "Done" or add another
- Confirmation dialog for removal should explicitly mention article deletion
- Feed row actions (remove, mark-all-read, rename) should use the same interaction pattern: hover buttons on desktop, swipe/long-press on mobile

</specifics>

<deferred>
## Deferred Ideas

- Feed auto-discovery from website URLs (enter blog URL, find RSS feed automatically)
- Feed categories/folders for grouping feeds
- Feed health monitoring (showing which feeds have errors or haven't updated)

</deferred>

---

*Phase: 03-feed-management*
*Context gathered: 2026-02-09*
