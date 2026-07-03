---
phase: 08-category-grouping
plan: 10
type: gap-closure
subsystem: frontend/settings-ui
tags:
  - badge-interaction
  - hover-effects
  - animation
  - uat-fix
dependency_graph:
  requires: []
  provides:
    - expandable-badge-dismiss-ui
  affects:
    - category-acknowledgement-ux
tech_stack:
  added: []
  patterns:
    - "Expandable container pattern (maxW transition)"
    - "Conditional border with semantic token"
key_files:
  created: []
  modified:
    - frontend/src/components/settings/CategoryRow.tsx
decisions:
  - "Use maxW transition from 0 to 16px for smooth expansion instead of fixed width reservation"
  - "Apply borderRight with border.subtle only when hovered to create visual separator"
  - "Use pl=1.5 for left padding and pl=2 on text for divider spacing"
metrics:
  duration: 2
  completed: 2026-02-16
---

# Phase 08 Plan 10: Badge Dismiss X Icon Polish

**One-liner:** Expandable badge X icon section with hover animation, left padding, and vertical divider separator

## Overview

Redesigned the New and Returned category badge dismiss X icons to expand on hover rather than pre-reserving space. Added proper spacing and a vertical divider for improved visual polish and interaction clarity.

## Implementation Details

**Pattern Applied:**
```tsx
<Flex alignItems="center" gap={0}>
  <Box
    display="flex"
    alignItems="center"
    maxW={isHovered ? "16px" : "0"}
    overflow="hidden"
    transition="max-width 0.15s"
    pl={isHovered ? 1.5 : 0}
    pr={1}
    borderRight={isHovered ? "1px solid" : undefined}
    borderColor="border.subtle"
  >
    <LuX size={10} />
  </Box>
  <Box pl={2}>New</Box>
</Flex>
```

**Key changes from previous implementation:**

1. **Width expansion animation** - Badge expands from compact (maxW=0) to reveal X section (maxW=16px) on hover
2. **Left padding** - X icon gets pl=1.5 when visible for spacing from left edge
3. **Vertical divider** - borderRight with border.subtle semantic token creates full-height separator
4. **Right padding on text** - pl=2 on text Box for spacing after divider
5. **No pre-reserved space** - gap=0 on parent Flex, no invisible width when not hovered

Applied identically to both:
- New badge (colorPalette="accent")
- Returned badge (colorPalette="yellow")

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

**frontend/src/components/settings/CategoryRow.tsx**
- Added Box import from @chakra-ui/react
- Updated New badge (lines 103-131) with expandable X section pattern
- Updated Returned badge (lines 133-161) with expandable X section pattern
- Replaced opacity-only pattern with maxW transition pattern
- Added conditional padding and borderRight with semantic token

## Testing

**Build verification:**
```
✓ Compiled successfully in 3.4s
✓ TypeScript checks passed
```

**Expected behavior:**
- Badge starts compact with no reserved space
- On hover, badge width visibly expands
- X icon appears with left padding (spacing from edge)
- Vertical divider line separates X from badge text
- Text has proper spacing after divider
- Smooth 0.15s transition animation

## UAT Impact

**Addresses UAT test #9:**
- ✓ Badge X icon has proper left padding when visible
- ✓ Full-height vertical divider separates X from text
- ✓ Badge expands on hover (no pre-reserved space)
- ✓ Smooth animation provides visual feedback

## Self-Check: PASSED

**Created files:**
- ✓ .planning/phases/08-category-grouping/08-10-SUMMARY.md

**Modified files:**
- ✓ frontend/src/components/settings/CategoryRow.tsx (exists)

**Commits:**
- ✓ 3dac00d: feat(08-10): improve badge dismiss X icon with expandable section

## Context for Next Steps

This completes gap closure plan 10 of phase 08. The badge dismiss interaction now has:
- Visual polish via spacing and divider
- Smooth hover animation
- No layout shift from pre-reserved space

Pattern is reusable for any hover-reveal badge interactions in future work.
