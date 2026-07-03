---
phase: quick-19
plan: 01
subsystem: frontend/settings
tags: [performance, dom-reduction, tooltip, breakpoint]
dependency_graph:
  requires: []
  provides: [simplified-weight-preset-strip]
  affects: [frontend/src/components/settings/WeightPresetStrip.tsx]
tech_stack:
  added: []
  patterns: [native-title-tooltip]
key_files:
  modified:
    - frontend/src/components/settings/WeightPresetStrip.tsx
decisions:
  - Native HTML title attribute replaces Chakra Tooltip for weight button hover labels — eliminates 350 Zag state machines and 70 MediaQueryList listeners with no meaningful UX regression
metrics:
  duration_min: 3
  completed: 2026-02-20T22:39:54Z
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 19: Remove Tooltip and useBreakpointValue from WeightPresetStrip Summary

**One-liner:** Replaced 5 Chakra Tooltip wrappers per WeightPresetStrip instance with native `title` HTML attributes, removing `useBreakpointValue` that only existed to disable those tooltips on mobile.

## What Was Done

Single task: edited `WeightPresetStrip.tsx` to remove the Chakra Tooltip wrappers around each of the 5 weight buttons and the `useBreakpointValue` call that toggled them off on mobile. Added `title={option.label}` directly on each `Button` for native browser tooltip on desktop hover.

**Before:** Each of the 5 weight buttons wrapped in `<Tooltip content={...} disabled={tooltipDisabled}>`. With 35 categories in the tree, this created 175 Tooltip instances = 350 Zag state machines + 70 MediaQueryList listeners for `useBreakpointValue`.

**After:** Each Button has `title={option.label}`. Accessibility preserved via existing `aria-label={option.label}`. Native tooltip provided on desktop hover with zero JS overhead.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | 7b9432a | feat(quick-19): replace Tooltip wrappers with native title in WeightPresetStrip |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `frontend/src/components/settings/WeightPresetStrip.tsx` modified and committed
- Commit 7b9432a verified
- `bunx tsc --noEmit` passed with no errors
- No `Tooltip` import or `useBreakpointValue` reference remains in the file
- All 5 weight Buttons have `title={option.label}` prop
