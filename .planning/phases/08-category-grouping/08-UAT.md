---
status: complete
phase: 08-category-grouping
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md, 08-05-SUMMARY.md]
started: 2026-02-16T10:00:00Z
updated: 2026-02-16T10:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings sidebar shows 5 items with Categories tab
expected: Settings page sidebar shows 5 items in order: Feeds, Interests, Categories, Ollama, Feedback. Clicking "Categories" navigates to the Categories section.
result: issue
reported: "Works, but there is a shift of the layout when I move between either Feeds or Interests and any of the other three categories. The settings sidebar moves a couple of pixels to the right if I e.g. click from Feeds to Categories."
severity: cosmetic

### 2. Interests section shows text areas only
expected: The Interests section contains only the interest text areas and save button. No category weight buttons or topic categories section.
result: issue
reported: "Pass, but I would like the design to match the panels in the Ollama section. I want a single panel that contains both text fields, and that the labels for the input fields match the subheader style in the other sections for better visual continuity."
severity: cosmetic

### 3. Categories section loads with discovered categories
expected: The Categories section shows "Topic Categories" heading and lists all categories discovered by the LLM from scored articles. If no scored articles exist, shows empty state with "Categories will appear here once articles are scored by the LLM".
result: pass
note: "User noted that new deployments should seed base categories so the empty state is never reached. This is outside Phase 8 scope — worth tracking as a future todo."

### 4. Weight presets on ungrouped category
expected: Each ungrouped category row shows 5 weight preset buttons inline: Block, Reduce, Normal, Boost, Max. Clicking a preset highlights it (solid accent style) and saves the weight. The active preset reflects the current weight.
result: issue
reported: "Pass, but I want the buttons to use the Attached prop so that it is clear they belong together."
severity: cosmetic

### 5. Create a category group from selected categories
expected: Ungrouped categories have checkboxes. Select 2+ categories, then click "Group selected" button. A popover appears asking for a group name. Enter a name and click Create. The new group appears as a collapsible accordion with the selected categories inside.
result: pass

### 6. Group accordion with header weight presets
expected: Each group renders as a collapsible accordion. The header shows the group name on the left and 5 weight preset buttons on the right. Clicking weight presets does NOT toggle the accordion open/closed. Clicking the group name area expands/collapses to show child categories.
result: issue
reported: "Pass. The size of the buttons on the grouped categories should match the parent row as they otherwise look askew. There is also a layout shift of the buttons when the reset button appears after altering the weight of a child category. On both child categories and ungrouped categories, there should be a hover effect that subtly highlights the row in the same way we do it for category group parents."
severity: cosmetic

### 7. Category weight override within a group
expected: Inside a group, set a different weight on an individual category (e.g., set group to Normal but one category to Boost). The overridden category shows a visual override indicator and a reset (undo) button. Clicking reset removes the override and the category falls back to the group weight.
result: issue
reported: "Pass. However, categories with inherited weights should show the assigned weight in a more muted way compared to categories where the weight is overridden. The entire parent category row should be highlighted when hovered, at the moment, only the first part is highlighted, but not the section with weight buttons and delete-button."
severity: cosmetic

### 8. Drag category between containers
expected: Grab a category by its drag handle and drag it from the ungrouped list into a group, or from one group to another, or from a group back to ungrouped. A drag preview appears during the drag. The destination container highlights. On drop, the category moves and the change persists.
result: issue
reported: "Pass, but when dragged into a new group, there is no preview of the category row in the new group."
severity: minor

### 9. Rename a group
expected: Double-click (or long-press on mobile) a group name. The name becomes an editable input field. Type a new name and press Enter (or blur away). The group updates with the new name and re-sorts alphabetically among other groups.
result: issue
reported: "Pass, but the group also opens when pressed. We might need to rethink this and add an edit-button to the group row that displays on hover. This should be grouped with the delete button and both should follow the same pattern of hiding/showing when row is hovered."
severity: minor

### 10. Delete a group
expected: Click the delete (trash) icon on a group header. A confirmation dialog appears showing the group name and how many categories will be ungrouped. Clicking Delete removes the group. Its categories return to the ungrouped list. Their individual weight overrides are preserved.
result: pass

### 11. Hide a category
expected: Hover over a category row to reveal a hide button (eye-off or X icon). Click it. The category disappears from the visible list. It is treated as blocked in the scoring pipeline.
result: pass
note: "User clarified: hidden categories should NOT be treated as blocked. They should only be removed from display and not included in the LLM's available category list. Hidden categories should serve as training signal for the feedback system (Phase 9) to learn which categories are unwanted."

### 12. Notification badges for new categories
expected: When new categories are discovered by the LLM (categories not in seen_categories), three levels of notification appear: (1) an orange dot on the settings gear icon in the main header, (2) a count badge next to "Categories" in the settings sidebar, (3) a count badge next to the "Topic Categories" heading. Individual new categories show a "New" chip badge on their row.
result: issue
reported: "Pass. However, include a small x icon on the chip marking a new category that appears when hovered, so that it becomes more obvious what happens when it is clicked. The icon should be on the left of the chip so that there is no layout shifts when the hover appears."
severity: cosmetic

## Summary

total: 12
passed: 4
issues: 8
pending: 0
skipped: 0

## Gaps

- truth: "Settings sidebar position stays stable when switching between sections"
  status: failed
  reason: "User reported: Works, but there is a shift of the layout when I move between either Feeds or Interests and any of the other three categories. The settings sidebar moves a couple of pixels to the right if I e.g. click from Feeds to Categories."
  severity: cosmetic
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Weight preset buttons use attached prop to visually group as a single segmented control"
  status: failed
  reason: "User reported: Pass, but I want the buttons to use the Attached prop so that it is clear they belong together."
  severity: cosmetic
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Child category weight preset buttons match parent group header button size, no layout shift on reset button appear, and category rows have subtle hover highlight"
  status: failed
  reason: "User reported: Button size mismatch between group header and child rows looks askew. Layout shift when reset button appears after overriding a child weight. Missing hover effect on child and ungrouped category rows (should match group header hover)."
  severity: cosmetic
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Group rename uses hover-reveal edit button instead of double-click, grouped with delete button in consistent hover pattern"
  status: failed
  reason: "User reported: Group also opens when pressed to rename. Replace double-click with hover-reveal edit button grouped with delete button, both following the same hide/show-on-hover pattern."
  severity: minor
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Dragged category shows preview placeholder in destination container during drag"
  status: failed
  reason: "User reported: Pass, but when dragged into a new group, there is no preview of the category row in the new group."
  severity: minor
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Inherited weights shown muted vs overridden, and group parent row hover highlights the full row including weight buttons and delete button"
  status: failed
  reason: "User reported: Categories with inherited weights should show weight in more muted way compared to overridden. Parent category row hover only highlights first part, not the weight buttons and delete-button section."
  severity: cosmetic
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "New category chip badge shows hover-reveal X icon on the left for dismiss affordance without layout shift"
  status: failed
  reason: "User reported: Include a small x icon on the chip marking a new category that appears when hovered, so it becomes more obvious what happens when clicked. Icon should be on the left to avoid layout shift."
  severity: cosmetic
  test: 12
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Interests section design matches the panel card pattern used in Ollama and other settings sections"
  status: failed
  reason: "User reported: Pass, but I would like the design to match the panels in the Ollama section. I want a single panel that contains both text fields, and that the labels for the input fields match the subheader style in the other sections for better visual continuity."
  severity: cosmetic
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
