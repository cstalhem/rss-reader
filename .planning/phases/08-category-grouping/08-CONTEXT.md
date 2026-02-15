# Phase 8: Category Grouping - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Hierarchical category organization with cascading weights. Users can create named groups, drag categories into them, and set weights at group or category level with clear inheritance. The scoring pipeline resolves effective weight using priority: explicit override > group default > neutral (1.0).

Categories are auto-discovered by the LLM and can be individually removed. Removed categories reappear with a notice if the LLM rediscovers them.

</domain>

<decisions>
## Implementation Decisions

### Tree Interaction
- Collapsible accordion structure — each group is an expandable card, categories listed inside
- Select + group action for creating groups — user checks multiple categories, clicks "Group selected", names the group in a small popover dialog
- Drag-and-drop to move categories between groups (primary reorganization method)
- Drag-and-drop from ungrouped flat list into existing group accordions
- Groups are alphabetically auto-sorted (no manual reorder)
- Group rename follows the same interaction pattern as feed names in the sidebar
- Delete group shows confirmation dialog, releases child categories back to ungrouped
- Individual categories (grouped or ungrouped) can be removed/hidden

### Weight UX
- 5 preset buttons: Block (0.0), Reduce (0.5), Normal (1.0), Boost (1.5), Max (2.0)
- Replaces the existing +/- weight buttons entirely (clean break)
- Group weight presets sit in the accordion header (always visible even when collapsed)
- Category weight presets sit inline next to each category row
- Default state is inherited (from group) — no special indicator for inherited
- Overridden categories show a visual indicator ("Overridden" label or accent-color buttons) plus a reset-to-inherited action
- Ungrouped categories always have settable weights, default to Normal (1.0)

### Ungrouped Categories
- Flat list below group accordions with "Ungrouped" subsection heading (muted style matching Ollama subsections)
- Categories in the ungrouped list are selectable (checkboxes) for grouping and also draggable into existing groups
- Every ungrouped category has its own weight preset buttons, defaulting to Normal

### New Category Flow
- New categories from LLM scoring appear in ungrouped list with a "New" labeled chip badge
- Previously removed categories that reappear get a "Returned" labeled chip badge
- Badges are dismissed by: setting a weight, grouping the category, or clicking/dismissing the badge directly
- Three-tier notification for new categories:
  1. Small round dot badge on the settings gear icon in the main UI (no count)
  2. Count badge on the "Categories" sidebar item in settings (positioned like the Ollama download indicator)
  3. Count badge next to the "Topic Categories" panel heading inside the Categories section

### Settings Design
- Current "Interests" section splits into two separate settings sidebar entries:
  - **Interests** — Interest description text areas (what you care about, what to avoid)
  - **Categories** — Category groups, ungrouped categories, weight presets
- Settings sidebar order: Feeds > Interests > Categories > Ollama > Feedback (5 items)
- Categories section uses the multi-panel card pattern (matching Ollama's style)
- "Group selected" button lives in the Topic Categories panel header
- Categories panel contains both group accordions and ungrouped flat list

### Claude's Discretion
- Exact drag-and-drop library choice and implementation
- Accordion expand/collapse animation details
- Exact badge/chip styling and positioning within rows
- Popover layout for group naming dialog
- Empty state when no categories exist yet
- How "remove category" is triggered (icon button, context menu, etc.)

</decisions>

<specifics>
## Specific Ideas

- Group rename should match the feed rename interaction in the sidebar (user mentioned this explicitly)
- Notification badges follow the same positioning as the Ollama download indicator on the settings sidebar
- Preset buttons should feel like a segmented control or toggle group rather than separate disconnected buttons
- "Returned" badge for rediscovered categories should be visually distinct from "New" (different color/label)

</specifics>

<deferred>
## Deferred Ideas

- LLM-suggested weights based on feedback patterns — Phase 9 (Feedback Loop)
- Category weight suggestions from interest alignment analysis — Phase 9

</deferred>

---

*Phase: 08-category-grouping*
*Context gathered: 2026-02-15*
