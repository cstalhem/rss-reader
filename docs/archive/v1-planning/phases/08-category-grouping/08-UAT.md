---
status: resolved
phase: 08-category-grouping
source: [08-06-SUMMARY.md, 08-07-SUMMARY.md, 08-08-SUMMARY.md]
started: 2026-02-16T15:00:00Z
updated: 2026-02-16T16:00:00Z
previous_session: "diagnosed (8 gaps found, all addressed by plans 08-06, 08-07, 08-08)"
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Settings sidebar stability when switching sections
expected: Switch between Feeds, Interests, Categories, Ollama sections in settings. The sidebar should NOT shift horizontally — stays perfectly stable regardless of which section is visible, even when some sections have scrollable content.
result: pass
note: "User requests: (1) scrollbar should only appear while scrolling, not permanently visible — use overlay scrollbar instead of scrollbar-gutter. (2) Sidebar should be fixed/sticky and always visible when content scrolls. Track as follow-up improvements."

### 2. Interests section matches Ollama panel pattern
expected: The Interests section has both text areas wrapped in a single panel card (subtle background, border, padding) matching the Ollama section style. Labels are uppercase subheaders (small, semibold, muted) instead of inline field labels.
result: issue
reported: "Subheaders does not follow the same design as in the Ollama section. We want all headings, subheadings, labels, etc, in the settings to have the same design and not contain duplicate styling"
severity: cosmetic

### 3. Weight preset buttons are a segmented control
expected: Weight preset buttons (Block/Reduce/Normal/Boost/Max) render as a fused segmented control — buttons are visually attached with no gap between them and shared outer border radius (inner borders removed).
result: pass
note: "User notes: (1) Individual non-accented buttons are hard to distinguish from each other — needs better visual separation. (2) Buttons are not aligned between parent category row and sub-category rows. Both tracked as future UI/UX refactoring items."

### 4. Child and parent button sizes match with stable reset space
expected: Weight preset buttons on child categories inside a group are the same size as the parent group header buttons. When overriding a child weight, the undo/reset button appears WITHOUT causing any layout shift — the space is pre-reserved.
result: pass

### 5. Category rows show hover highlights
expected: Hovering over an ungrouped category row shows a subtle background highlight. Same for child category rows inside a group. On group headers, hovering highlights the ENTIRE row including the weight buttons and delete button on the right side.
result: pass

### 6. Inherited weights show muted styling
expected: Categories inside a group that have the inherited group weight (not overridden) show their weight preset buttons at reduced opacity compared to categories with explicit overrides or ungrouped categories. The active preset is still visible but distinctly muted.
result: pass

### 7. Group rename uses hover-reveal edit button
expected: Hovering over a group header reveals a pencil (edit) icon button alongside the delete button. Both are hidden when not hovered. Clicking the pencil button enters rename mode. The accordion does NOT toggle when clicking edit/delete buttons.
result: pass

### 8. Drag placeholder appears in destination container
expected: When dragging a category toward a group or the ungrouped list, a dashed placeholder row appears inside the destination container showing where the category will land. The placeholder shows the category name.
result: issue
reported: "This does not work. The placeholder does not appear in the destination container, only in the current container. The performance is also not good in Safari, it's a bit laggy when dragging the row around."
severity: major

### 9. Badge dismiss shows hover-reveal X icon
expected: New/Returned category badge chips show a small X icon on the left side when the row is hovered. The X appears via opacity transition (no layout shift). Clicking the X dismisses/acknowledges the badge.
result: issue
reported: "I don't like the look of these. Need more spacing between the left edge of the chip and the X icon, a full-height divider between the X icon and the text, and don't reserve space on the chip initially since it looks strange — the chip should expand on hover to reveal the X section rather than having invisible reserved space."
severity: cosmetic

## Summary

total: 9
passed: 6
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Interests section subheaders match the same design pattern as Ollama and other settings sections"
  status: resolved
  reason: "User reported: Subheaders does not follow the same design as in the Ollama section. We want all headings, subheadings, labels, etc, in the settings to have the same design and not contain duplicate styling"
  severity: cosmetic
  test: 2
  root_cause: "Inconsistent heading patterns across settings sections. InterestsSection uses fontSize=sm, textTransform=uppercase, letterSpacing=wider for panel subheaders. OllamaSection uses fontSize=lg, fontWeight=semibold, mb=4 for panel subheaders. Two completely different patterns for the same role. CategoriesSection uses yet another variant. No shared component or consistent convention."
  artifacts:
    - "frontend/src/components/settings/InterestsSection.tsx:86-91: uppercase sm subheaders"
    - "frontend/src/components/settings/OllamaSection.tsx:112: lg semibold subheaders"
    - "frontend/src/components/settings/CategoriesSection.tsx:510-513: yet another variant"
  missing:
    - "Establish one subheader pattern and apply consistently across all settings sections"
    - "Consider extracting a shared SectionSubheader component or standardizing inline"
  debug_session: ""

- truth: "Badge dismiss X icon has proper spacing, divider, and expands chip on hover instead of reserving space"
  status: resolved
  reason: "User reported: Need more spacing between left edge and X icon, full-height divider between X and text, and chip should expand on hover to reveal X section rather than pre-reserving invisible space"
  severity: cosmetic
  test: 9
  root_cause: "CategoryRow.tsx lines 113-121 and 136-144: LuX icon is always rendered inside Badge Flex with opacity transition, but the icon always occupies space (gap=0.5 in Flex). No left padding before icon, no divider between icon and text. User wants the X section to be hidden entirely (not just invisible) and expand the chip width on hover."
  artifacts:
    - "frontend/src/components/settings/CategoryRow.tsx:103-123: New badge with always-present LuX"
    - "frontend/src/components/settings/CategoryRow.tsx:126-147: Returned badge with same pattern"
  missing:
    - "Use width animation or conditional rendering with CSS transition to expand chip on hover"
    - "Add left padding/margin before X icon"
    - "Add a full-height thin divider (borderRight or Box with height=100%) between X icon and text"
    - "Hide X section entirely when not hovered (display or width=0 with overflow=hidden)"
  debug_session: ""

- truth: "Dragged category shows placeholder row in destination container (not source)"
  status: resolved
  reason: "User reported: Placeholder does not appear in destination container, only in current container. Performance is also laggy in Safari when dragging."
  severity: major
  test: 8
  root_cause: "CategoriesSection.tsx passes activeId to child containers, and placeholder condition is isOver && activeId && !items.includes(activeId). The logic is semantically correct but may have timing issues — isOver can briefly be true for the source at drag start. More likely: the destination group accordion may be collapsed, hiding the placeholder inside Accordion.ItemContent. Also need to verify activeId prop is correctly wired to destination CategoryGroupAccordion instances. Safari lag is likely caused by re-renders on every drag position change."
  artifacts:
    - "frontend/src/components/settings/CategoriesSection.tsx:251-253: onDragStart sets activeId"
    - "frontend/src/components/settings/CategoryGroupAccordion.tsx:90-91: placeholder condition"
    - "frontend/src/components/settings/CategoriesSection.tsx:72-87: UngroupedDroppable placeholder"
  missing:
    - "Verify activeId is passed correctly to all CategoryGroupAccordion instances"
    - "Render placeholder outside Accordion.ItemContent for collapsed groups"
    - "Track source container to exclude from placeholder rendering"
    - "Investigate Safari drag performance (minimize re-renders, use CSS transforms)"
  debug_session: ""
