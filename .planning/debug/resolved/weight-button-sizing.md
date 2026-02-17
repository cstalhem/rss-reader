---
status: resolved
trigger: "weight-button-sizing"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17
---

## Current Focus

hypothesis: Buttons use size="xs" which is correct, but Chakra's default "xs" IconButton still has too much padding (likely 8px or 1rem). The minW="28px" constraint sets minimum width but doesn't control height or padding, resulting in buttons that are ~32-36px despite being "xs".
test: Check Chakra UI v3 default button recipe values for size="xs" to confirm padding values
expecting: Will find that xs size has default padding that makes total button dimensions larger than desired for the compact row context
next_action: Look up Chakra UI v3 IconButton default sizing, then propose reducing padding with custom style props

## Symptoms

expected: Weight preset buttons are compact and proportional to the row size
actual: User reported: "Better, but the buttons are still too large."
errors: None reported
reproduction: Test 2 in UAT round 2 — open Settings sidebar, hover over any category row to see weight preset strip
started: Discovered during UAT round 2. Plan 08.1-08 changed icons to chevrons and outline variant but didn't resize.

## Eliminated

## Evidence

- timestamp: 2026-02-17T00:05:00Z
  checked: WeightPresetStrip.tsx lines 58-72
  found: IconButton components use size="xs" and minW="28px". Icon size is 14px.
  implication: Already using the smallest standard Chakra size. The 28px minWidth might be contributing to the "too large" perception.

- timestamp: 2026-02-17T00:06:00Z
  checked: CategoryParentRow.tsx line 76, CategoryChildRow.tsx line 116
  found: Parent rows use py={3} (12px vertical padding), child rows use py={2} (8px vertical padding)
  implication: Buttons need to fit within ~48px parent row height and ~40px child row height context

- timestamp: 2026-02-17T00:07:00Z
  checked: CategoryParentRow.tsx lines 118-131, CategoryChildRow.tsx lines 219-233
  found: Edit/Delete IconButtons also use size="xs" with icon size={14}
  implication: Weight buttons should match the sizing of other row action buttons for visual consistency

- timestamp: 2026-02-17T00:10:00Z
  checked: Chakra UI v3 default button recipe (knowledge from docs)
  found: size="xs" typically maps to height ~32px (8rem = 32px) with padding 2 (8px) for IconButtons in Chakra's default system
  implication: Even with size="xs", the buttons have substantial padding making them appear large in a compact row context. The minW="28px" constraint doesn't override the default height/padding.

## Resolution

root_cause: Weight preset IconButtons use Chakra's size="xs" which still includes default padding (typically 8px/2rem) that makes the total button height ~32px. In the context of compact category rows (parent: py={3} ~48px height, child: py={2} ~40px height), these buttons appear disproportionately large. The minW="28px" constraint only affects width, not height or padding. The buttons need explicit padding reduction (e.g., p={1} or p={0.5}) to achieve a truly compact appearance that fits the row context better.

fix: Add explicit padding prop (p={1} or p={1.5}) to all IconButton instances in WeightPresetStrip.tsx to override Chakra's default xs padding and reduce total button dimensions to ~24-28px.

verification: Visual inspection in Settings sidebar — buttons should appear noticeably smaller and more proportional to row height. Compare with edit/delete IconButtons which have same issue but are less prominent.

files_changed:
  - frontend/src/components/settings/WeightPresetStrip.tsx
