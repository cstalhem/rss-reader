---
status: diagnosed
phase: 08-category-grouping
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md, 08-05-SUMMARY.md]
started: 2026-02-16T10:00:00Z
updated: 2026-02-16T14:30:00Z
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
  root_cause: "Some sections (Categories, Ollama, Feedback) have taller scrollable content that triggers a vertical scrollbar, while others (Feeds, Interests) don't. When the scrollbar appears, it takes up space (~15px on macOS), pushing the sidebar to the left. The container doesn't reserve space for the scrollbar, causing the shift."
  artifacts:
    - "frontend/src/app/settings/page.tsx: Desktop layout uses display:none to toggle sections, all mounted simultaneously but only one visible at a time"
  missing:
    - "Reserve scrollbar space on the container to prevent layout shift (e.g., `overflow-y: scroll` instead of `auto`, or scrollbar gutter CSS)"
  debug_session: ""

- truth: "Weight preset buttons use attached prop to visually group as a single segmented control"
  status: failed
  reason: "User reported: Pass, but I want the buttons to use the Attached prop so that it is clear they belong together."
  severity: cosmetic
  test: 4
  root_cause: "WeightPresets component renders 5 individual Button components with gap={0.5} spacing between them, but doesn't wrap them in a Group component with attached prop. Chakra UI v3's Group component with attached prop fuses buttons into a segmented control by removing inner border radius."
  artifacts:
    - "frontend/src/components/settings/WeightPresets.tsx: Buttons rendered directly in Flex with gap={0.5}"
  missing:
    - "Wrap buttons in <Group attached> component from Chakra UI v3 to create segmented control appearance"
  debug_session: ""

- truth: "Child category weight preset buttons match parent group header button size, no layout shift on reset button appear, and category rows have subtle hover highlight"
  status: failed
  reason: "User reported: Button size mismatch between group header and child rows looks askew. Layout shift when reset button appears after overriding a child weight. Missing hover effect on child and ungrouped category rows (should match group header hover)."
  severity: cosmetic
  test: 6
  root_cause: "Three separate issues: (1) Button size mismatch: CategoryGroupAccordion passes size='sm' to parent WeightPresets, but CategoryRow passes size='xs' (default) to child WeightPresets. (2) Reset button layout shift: Reset button appears conditionally with ml={0.5} in WeightPresets, causing preceding buttons to shift left when it appears. Need fixed-width reserved space. (3) Missing hover: CategoryRow has no hover background effect (bg='bg.subtle' already, no _hover prop), while CategoryGroupAccordion ItemTrigger has _hover={{ bg: 'bg.muted' }}."
  artifacts:
    - "frontend/src/components/settings/CategoryGroupAccordion.tsx:179: Passes size='sm' to WeightPresets"
    - "frontend/src/components/settings/CategoryRow.tsx:129: Uses default size='xs' for WeightPresets"
    - "frontend/src/components/settings/WeightPresets.tsx:53-67: Reset button conditionally rendered with ml={0.5}"
    - "frontend/src/components/settings/CategoryRow.tsx:64-74: Flex wrapper has no _hover prop"
  missing:
    - "Change CategoryRow to pass size='sm' to WeightPresets to match parent"
    - "Reserve fixed-width space for reset button in WeightPresets (render invisible placeholder when isOverridden=false)"
    - "Add _hover={{ bg: 'bg.muted' }} to CategoryRow Flex wrapper"
  debug_session: ""

- truth: "Group rename uses hover-reveal edit button instead of double-click, grouped with delete button in consistent hover pattern"
  status: failed
  reason: "User reported: Group also opens when pressed to rename. Replace double-click with hover-reveal edit button grouped with delete button, both following the same hide/show-on-hover pattern."
  severity: minor
  test: 9
  root_cause: "CategoryGroupAccordion uses onDoubleClick handler on the group name Text element to trigger rename mode, but the entire row is an Accordion.ItemTrigger that toggles open/closed on any click. Double-clicking triggers both the rename and the accordion toggle, causing awkward UX. The delete button (LuTrash2) is always visible, not hover-reveal."
  artifacts:
    - "frontend/src/components/settings/CategoryGroupAccordion.tsx:158-167: onDoubleClick handler on Text element inside ItemTrigger"
    - "frontend/src/components/settings/CategoryGroupAccordion.tsx:182-193: Delete IconButton always visible, not conditional on hover"
  missing:
    - "Remove onDoubleClick rename trigger"
    - "Add hover-reveal edit button (LuPencil icon) next to delete button"
    - "Make both edit and delete buttons opacity-based hover-reveal (similar to CategoryRow hide button pattern)"
    - "Group edit and delete buttons visually"
  debug_session: ""

- truth: "Dragged category shows preview placeholder in destination container during drag"
  status: failed
  reason: "User reported: Pass, but when dragged into a new group, there is no preview of the category row in the new group."
  severity: minor
  test: 8
  root_cause: "DragOverlay in CategoriesSection shows the dragged category floating during drag, and destination containers (groups and ungrouped) highlight via useDroppable isOver state. However, there's no optimistic preview placeholder rendered *inside* the destination container showing where the category will land. dnd-kit doesn't automatically render this - it must be manually added by checking isDragging and isOver states."
  artifacts:
    - "frontend/src/components/settings/CategoriesSection.tsx:530-543: DragOverlay renders floating preview"
    - "frontend/src/components/settings/CategoriesSection.tsx:59-72: UngroupedDroppable uses isOver for background highlight only"
    - "frontend/src/components/settings/CategoryGroupAccordion.tsx:199-238: Group droppable uses isOver for background highlight only"
  missing:
    - "Add placeholder CategoryRow (with opacity=0.5, dashed border) inside destination containers when isOver=true during drag"
    - "Pass isDragging and activeId state down to CategoryGroupAccordion and UngroupedDroppable to conditionally render placeholder"
  debug_session: ""

- truth: "Inherited weights shown muted vs overridden, and group parent row hover highlights the full row including weight buttons and delete button"
  status: failed
  reason: "User reported: Categories with inherited weights should show weight in more muted way compared to overridden. Parent category row hover only highlights first part, not the weight buttons and delete-button section."
  severity: cosmetic
  test: 7
  root_cause: "Two separate issues: (1) Inherited weight styling: WeightPresets component doesn't differentiate between inherited (group default) and overridden weights visually. Buttons have same opacity and styling regardless of isOverridden prop. Need to reduce opacity when weight is inherited. (2) Group header hover incomplete: The hover bg effect in CategoryGroupAccordion only applies to the Accordion.ItemTrigger (left side), not the Flex on the right containing WeightPresets and delete IconButton. The layout has two sibling Flex elements - ItemTrigger and the right-side controls - so hover doesn't cover full row."
  artifacts:
    - "frontend/src/components/settings/WeightPresets.tsx:36-51: Button styling doesn't check isOverridden prop for opacity"
    - "frontend/src/components/settings/CategoryGroupAccordion.tsx:117-194: Hover only on ItemTrigger, not the outer Flex wrapper"
  missing:
    - "Add opacity={isOverridden ? 1 : 0.6} or similar to WeightPresets buttons when !isOverridden"
    - "Wrap entire group header (ItemTrigger + right controls) in a parent Flex with _hover state, or move hover state to a common parent"
  debug_session: ""

- truth: "New category chip badge shows hover-reveal X icon on the left for dismiss affordance without layout shift"
  status: failed
  reason: "User reported: Include a small x icon on the chip marking a new category that appears when hovered, so it becomes more obvious what happens when clicked. Icon should be on the left to avoid layout shift."
  severity: cosmetic
  test: 12
  root_cause: "CategoryRow renders Badge components for 'New' and 'Returned' states with cursor='pointer' and onClick handlers to dismiss, but the badges show no visual affordance that they're clickable. No X icon or hover state change. The badge is just a colored chip with text, giving no indication that clicking it will dismiss the badge."
  artifacts:
    - "frontend/src/components/settings/CategoryRow.tsx:101-127: Badge components with onClick but no icon or hover affordance"
  missing:
    - "Add hover state tracking to CategoryRow"
    - "Render LuX icon inside Badge with opacity-based hover-reveal (opacity: 0 → 1 on row hover)"
    - "Position icon on the left inside Badge to avoid layout shift (badge width increases leftward, not rightward)"
    - "Consider using Badge children slot pattern or Flex inside Badge for icon+text layout"
  debug_session: ""

- truth: "Interests section design matches the panel card pattern used in Ollama and other settings sections"
  status: failed
  reason: "User reported: Pass, but I would like the design to match the panels in the Ollama section. I want a single panel that contains both text fields, and that the labels for the input fields match the subheader style in the other sections for better visual continuity."
  severity: cosmetic
  test: 2
  root_cause: "InterestsSection renders Field components directly in a Stack without wrapping them in a panel Box. OllamaSection wraps each logical section in a Box with bg='bg.subtle', borderRadius='md', borderWidth='1px', borderColor='border.subtle', p={6}, and uses Text with fontSize='lg', fontWeight='semibold' for subheaders. InterestsSection uses fontSize='xl' for the main heading and Field label prop for input labels, not matching the subheader pattern."
  artifacts:
    - "frontend/src/components/settings/InterestsSection.tsx:70-114: No panel Box wrapper, Field labels don't match subheader style"
    - "frontend/src/components/settings/OllamaSection.tsx:111-125: Panel Box pattern with Text subheader at line 112"
  missing:
    - "Wrap both Field components in a single panel Box with the standard bg/border/padding props"
    - "Replace Field label prop with Text component using fontSize='sm', fontWeight='semibold', color='fg.muted', textTransform='uppercase', letterSpacing='wider' (matching subheader pattern from CategoriesSection ungrouped heading)"
    - "Keep section title 'Interest Preferences' outside the panel as the main heading"
  debug_session: ""
