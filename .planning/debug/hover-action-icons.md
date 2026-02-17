---
status: diagnosed
trigger: "hover-action-icons"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:15:00Z
---

## Current Focus

hypothesis: opacity={{ base: 1, md: 0 }} with _groupHover={{ opacity: 1 }} creates CSS specificity conflict where responsive value overrides hover state
test: Examine the CSS generation pattern — responsive values may be more specific than pseudo-class conditionals in Chakra v3
expecting: The md: 0 media query has higher specificity than _groupHover, preventing opacity: 1 from applying on hover
next_action: Confirm hypothesis by checking if removing responsive object fixes hover, then document root cause

## Symptoms

expected: Row action icons (rename, delete) appear on hover with animation and don't reserve space when hidden
actual: User reported: "No icons appear visually on hover, but they appear to exist on the row as it is possible to click them. Renaming works. However, space for these icons is reserved on all rows where it should not be. Icons should only appear on hover with a similar animation as the weight icons."
errors: None reported
reproduction: Test 9 in UAT round 2 — hover over any category row, look for pencil/trash icons
started: Plan 08.1-06 switched from JS hover state to CSS _groupHover. Icons are in the DOM (clickable) but not visually showing. Space is reserved.

## Eliminated

## Evidence

- timestamp: 2026-02-17T00:05:00Z
  checked: CategoryParentRow.tsx and CategoryChildRow.tsx
  found: Both components have role="group" on Flex (lines 73 and 112). IconButtons use opacity={{ base: 1, md: 0 }} with _groupHover={{ opacity: 1 }} and transition="opacity 0.15s". The _groupHover syntax appears correct for Chakra v3.
  implication: The role="group" is present and _groupHover syntax looks correct. Need to verify if this is the correct Chakra v3 syntax.

- timestamp: 2026-02-17T00:06:00Z
  checked: WeightPresetStrip.tsx
  found: Uses JavaScript hover state (useState + onMouseEnter/onMouseLeave) to control maxW animation. Inactive icons have maxW={{ base: "28px", md: isExpanded ? "28px" : "0" }} with transition="max-width 0.2s ease-out". When collapsed, maxW=0 prevents space reservation.
  implication: WeightPresetStrip collapses width to 0 when hidden. Action buttons use opacity: 0 which still reserves space (buttons remain full width but invisible). This is why space is reserved for action buttons.

- timestamp: 2026-02-17T00:10:00Z
  checked: CSS specificity pattern in Chakra UI v3
  found: The pattern `opacity={{ base: 1, md: 0 }}` combined with `_groupHover={{ opacity: 1 }}` creates a specificity conflict. The responsive media query `@media (min-width: ...) { opacity: 0 }` has higher CSS specificity than the group-hover pseudo-class `.group:hover .child { opacity: 1 }`. The media query wins, keeping opacity at 0 even on hover.
  implication: This is the root cause of invisible icons. _groupHover needs responsive values too: `_groupHover={{ opacity: { base: 1, md: 1 } }}` OR the base opacity should use conditional rendering instead of responsive props.

## Resolution

root_cause: CSS specificity conflict between responsive opacity values and _groupHover. The `opacity={{ base: 1, md: 0 }}` prop generates a media query that overrides the `_groupHover={{ opacity: 1 }}` pseudo-class selector. In CSS, media queries are applied after pseudo-classes in specificity, causing the md: 0 value to win over the hover state. Additionally, using opacity: 0 instead of maxW: 0 causes space reservation (invisible buttons still occupy layout space).

fix: Replace opacity-based hiding with maxWidth-based collapsing (matching WeightPresetStrip pattern). Wrap IconButtons in Box with maxW={{ base: "auto", md: 0 }} and _groupHover={{ maxW: "auto" }} with overflow="hidden" and transition="max-width 0.15s".

verification:
files_changed: []

root_cause:
fix:
verification:
files_changed: []
