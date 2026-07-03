# Phase 2: Article Reading UI - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can browse and read articles in a clean interface with theme control. This phase delivers the article list, reading panel, read/unread state management, and dark/light theme. Feed management, LLM scoring, and content filtering belong to later phases.

</domain>

<decisions>
## Implementation Decisions

### Article list layout
- Relaxed list layout (not cards, not cramped) — multi-line rows with breathing room
- Each row displays: title, muted source, date
- Titles truncate with ellipsis (single line, uniform row height)
- "Load more" button at bottom (not infinite scroll, not pagination)
- Reserve layout space for future LLM reasoning/summary display (Phase 5)

### Reading experience
- Slide-in panel from the right, ~75% width on desktop
- Full-screen panel on mobile/smaller screens
- Full article content rendered in-app with clean typography
- Close via X button or clicking outside the panel
- Prev/next arrows to navigate between articles within the panel

### Read/unread behavior
- Auto-mark as read after 10-15 seconds of viewing (prevents accidental marks)
- Manual toggle available to mark read/unread
- Visual indicators for unread: opacity difference (read = faded) + indicator dot
- Default view: unread articles only
- Toggle to show all articles (read + unread)

### Theme & visual style
- Dark mode as default
- Theme toggle in header AND in settings
- Minimal/clean aesthetic — lots of whitespace, subtle borders, content-focused
- Orange accent color: `oklch(64.6% 0.222 41.116)`
- Sans-serif for UI elements
- Serif font for article reader content
- Generous typography in reader — larger text, more line spacing
- Images displayed in reader but constrained (max width/height)
- Collapsible sidebar navigation with feeds/sections

### Claude's Discretion
- Exact spacing and padding values
- Loading states and skeletons
- Error state handling
- Specific serif/sans-serif font choices
- Sidebar collapse behavior and breakpoints
- Panel slide animation timing

</decisions>

<specifics>
## Specific Ideas

- Orange accent provides warmth against dark minimal theme
- Reader typography should feel comfortable for long-form reading
- Unread indicator dot + opacity creates clear visual hierarchy without being noisy
- 10-15 second delay before auto-marking read prevents "just checking" from clearing the list

</specifics>

<deferred>
## Deferred Ideas

- Bulk "mark all as read" action — future iteration
- LLM reasoning/summary display in article list — Phase 5 (Interest-Driven UI)
- Feed management in sidebar — Phase 3 (Feed Management)
- Article filtering by score — Phase 5

</deferred>

---

*Phase: 02-article-reading-ui*
*Context gathered: 2026-02-05*
