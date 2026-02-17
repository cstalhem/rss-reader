---
status: diagnosed
trigger: "connector-line-gaps"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:08:00Z
---

## Current Focus

hypothesis: CONFIRMED - Stack gap=1 between child rows creates visible separation that vertical lines don't bridge
test: Analyze connector line CSS and row spacing in CategoryTree.tsx
expecting: Root cause identified in architecture
next_action: Return diagnosis

## Symptoms

expected: Vertical connector line between child rows is continuous with no gaps — a solid line from parent down through all children
actual: User reported: "Better and seems to work as expected, but there is a gap between child rows that we don't want." (See: per-child vertical line segments approach creates gaps between rows)
errors: None reported
reproduction: Test 1 in UAT round 2 — open Settings sidebar, navigate to Categories section, look at parent groups with multiple children
started: Discovered during UAT round 2. Plan 08.1-08 changed from container vertical line to per-child vertical segments for L-shape support.

## Eliminated

## Evidence

- timestamp: 2026-02-17T00:05:00Z
  checked: CategoryTree.tsx lines 89-136
  found: Children Stack has gap=1 (theme.spacing[1] = 4px). Each child Box has _before pseudo-element with height: isLast ? "50%" : "100%"
  implication: The gap=1 creates 4px space between rows. Vertical lines are 100% height of their Box, but don't extend into the gap itself.

- timestamp: 2026-02-17T00:06:00Z
  checked: CategoryChildRow.tsx lines 110-122
  found: Row has py={2} px={3} which adds vertical padding. Combined with Stack gap, this creates visible separation.
  implication: Vertical line spans 100% of Box height but Box doesn't include the Stack gap space between siblings.

- timestamp: 2026-02-17T00:07:00Z
  checked: Architecture analysis
  found: Per-child vertical segment approach: each child has _before pseudo (vertical) and _after pseudo (horizontal L-connector). Non-last children have height=100% to connect to next sibling, last child has height=50% to stop at its midpoint.
  implication: This assumes zero gap between siblings. With gap=1, there's 4px space that no pseudo-element spans.

## Resolution

root_cause: Stack gap=1 (4px) between child rows creates visible space that vertical connector lines don't bridge. The _before pseudo-element (vertical line) spans 100% of its containing Box height, but the Box doesn't extend into the Stack gap between siblings. Architecture assumes zero gap between rows for continuous vertical lines.
fix: Either (1) Remove gap=1 from Stack at line 89, OR (2) Extend _before pseudo height to include gap (height: calc(100% + 4px) for non-last children), OR (3) Move vertical line to parent container instead of per-child approach
verification: Visual inspection in browser - vertical line should be continuous with no gaps between child rows
files_changed:
  - frontend/src/components/settings/CategoryTree.tsx
