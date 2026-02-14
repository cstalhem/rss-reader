# Phase 6: UI & Theme Polish - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Refined visual design, improved UX consistency, and settings page reorganization. This phase makes the existing v1.0 UI feel polished — softer dark mode, loading skeletons, toast feedback, reader typography improvements, and settings page restructuring with sidebar navigation. No new features or capabilities.

</domain>

<decisions>
## Implementation Decisions

### Color palette & dark mode
- Warm-tinted dark backgrounds (slight brownish/amber undertone) — inspired by Readwise/Reader aesthetic
- Moderately softer contrast: lift backgrounds from near-black (~10% lightness) to dark gray (~15-18%), text stays high contrast but not pure white
- Orange accent stays vibrant at current saturation — deliberate pop against softer backgrounds
- Three surface levels: base background, panel/card, overlay/drawer — each a distinct warm-tinted step
- Subtle border lines for separation between elements (thin, low-opacity)
- Dark mode only — light mode stays as Chakra defaults
- Read/unread visual distinction (opacity 1.0 vs 0.6 + dot indicators) stays unchanged, just update colors to match new palette

### Settings page layout
- Sidebar navigation on the left, content area on the right
- Four sections: Feeds, Interests, Ollama, Feedback
- Feeds section added to settings (add/remove/reorder feeds), but existing sidebar feed management (add, mark as read, remove) stays unchanged
- Ollama and Feedback sections show as placeholders ("Coming soon") — establishes full structure for Phase 7 and 9
- On mobile (narrow screens): sidebar disappears, sections stack vertically as a scrollable page

### Reader typography
- Content body constrained to ~680px max-width, centered within the 75vw drawer
- Keep current font size (18px/1.125rem) and line height (1.75) for body text
- Article title in sans-serif (Inter), body content stays serif (Lora) — modern contrast
- More distinct article header: larger title, more breathing room, clearer visual break before body
- Polish code blocks: Fira Code monospace font, proper padding, distinct background from body
- Drawer stays at 75vw on desktop, 100% on mobile

### Claude's Discretion
- Exact warm-tint hue values for the three background levels
- Skeleton shimmer animation timing and color
- Icon choices for empty states
- Code block background color and padding values
- Settings sidebar width and styling
- Toast auto-dismiss timing
- Specific spacing values for the reader header "masthead"

</decisions>

<specifics>
## Specific Ideas

- Readwise/Reader as the aesthetic reference — warm, focused, reading-oriented dark mode
- Loading skeletons with shimmer animation that match article row layout
- Toast notifications positioned bottom-right
- Error states are toast-only (no inline error components) — components stay in last good state
- Empty states use icon + short message + optional action button (not just text)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-ui-theme-polish*
*Context gathered: 2026-02-14*
