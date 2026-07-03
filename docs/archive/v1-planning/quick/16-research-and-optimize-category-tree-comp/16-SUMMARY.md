---
phase: quick-16
plan: 01
subsystem: ui
tags: [react, performance, dom-optimization, chakra-ui, conditional-rendering]

requires:
  - phase: quick-15
    provides: useTransition skeleton deferral pattern
provides:
  - Optimized WeightPresetStrip with single responsive button per option
  - Conditional child rendering replacing Collapsible in CategoryTree
affects: [category-tree, settings-page]

tech-stack:
  added: []
  patterns:
    - "Single responsive Button with hidden text span replaces dual Button+IconButton per weight option"
    - "Conditional rendering (isExpanded &&) replaces Collapsible.Root/Content for collapsed children"

key-files:
  created: []
  modified:
    - frontend/src/components/settings/WeightPresetStrip.tsx
    - frontend/src/components/settings/CategoryTree.tsx

key-decisions:
  - "Single responsive Button per weight option instead of separate mobile Button + desktop IconButton"
  - "Conditional rendering replaces Collapsible for collapsed children (animation trade-off for DOM savings)"
  - "Menu and Tooltip already use lazyMount/unmountOnExit defaults in Chakra v3 -- no changes needed"

patterns-established:
  - "Responsive single-element pattern: one Button with responsive display for text label instead of dual mobile/desktop components"
  - "Conditional child rendering for expand/collapse instead of Collapsible.Root when DOM cost outweighs animation benefit"

requirements-completed: [QUICK-16]

duration: 14min
completed: 2026-02-20
---

# Quick Task 16: Research and Optimize Category Tree Render Summary

**Single responsive weight button and conditional child rendering reduce categories page DOM by 26.7% (8,057 to 5,908 nodes) and buttons by 50.2%**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-20T17:03:05Z
- **Completed:** 2026-02-20T17:17:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Identified root causes of category tree render overhead with concrete measurements
- Merged dual Button/IconButton per weight option into single responsive Button (50% button reduction)
- Replaced Collapsible.Root/Content with conditional rendering for collapsed children (0 hidden child nodes)
- Confirmed Chakra v3 Menu and Tooltip already use lazyMount/unmountOnExit defaults (no work needed)

## Profiling Findings (Task 1)

### Before Optimization (categories active on desktop)

| Metric | Count |
|--------|-------|
| Total DOM nodes | 8,057 |
| Total buttons | 1,579 |
| Tooltip triggers | 740 |
| Menu triggers (content lazy) | 70 |
| Collapsible closed children | 224 nodes in 2 closed parents |

### Root Causes Identified

1. **Dual WeightPresetStrip render per row**: Each category row rendered TWO WeightPresetStrip components (mobile + desktop via display:none). Each strip rendered TWO elements per weight option (mobile Button + desktop Box>Tooltip>IconButton). With 37 categories * 2 strips * 10 elements/strip = 740 weight-related elements.

2. **Collapsible mounts children when closed**: Chakra's Collapsible.Content renders children to DOM even with `data-state="closed"` (CSS hidden). Both collapsed parents had 112 child nodes each (224 total) mounted but invisible.

3. **Mobile page layout double-mounts all sections**: The settings page renders both mobile (stacked) and desktop (conditional) layouts. On desktop, the mobile layout is `display:none` but still mounts CategoriesSection, doubling all category components. This is a page-level architectural issue outside the category tree scope.

### After Optimization

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total DOM nodes | 8,057 | 5,908 | -2,149 (-26.7%) |
| Total buttons | 1,579 | 787 | -792 (-50.2%) |
| Tooltip triggers | 740 | 700 | -40 (-5.4%) |
| Collapsible closed nodes | 224 | 0 | -224 (-100%) |

## Task Commits

1. **Task 1: Profile and diagnose** - No commit (investigation only)
2. **Task 2: Implement optimizations** - `083d1bc` (perf)

## Files Modified

- `frontend/src/components/settings/WeightPresetStrip.tsx` - Merged dual mobile Button + desktop IconButton into single responsive Button with hidden text label on desktop
- `frontend/src/components/settings/CategoryTree.tsx` - Replaced Collapsible.Root/Content with conditional rendering for collapsed children; removed Collapsible import

## Decisions Made

1. **Single responsive Button replaces dual elements**: Each weight option now renders one Box > Tooltip > Button instead of separate mobile Button + desktop Box > Tooltip > IconButton. The text label uses `display: { base: "inline", md: "none" }` for mobile visibility. Saves one element per option per strip (5 elements per strip * 74 strips = 370 fewer elements).

2. **Conditional rendering replaces Collapsible**: Children use `{isExpanded && <children>}` instead of `<Collapsible.Root open={isExpanded}><Collapsible.Content>`. Trade-off: no expand/collapse CSS animation. Benefit: collapsed children completely unmounted (saved 224 nodes for 2 collapsed parents, scales linearly with parent count).

3. **No changes to Menu or Tooltip lazy behavior**: Profiling confirmed Chakra v3 Menu.Root and Tooltip.Root both default to `lazyMount: true, unmountOnExit: true`. Menu content: 0 nodes when closed. Tooltip content: 0 nodes when not hovered. Only trigger wrappers are in DOM.

4. **Kept dual strip per row (mobile/desktop)**: Could not eliminate the mobile/desktop WeightPresetStrip duplication per row without breaking the responsive layout (mobile strip needs its own line below the row, desktop strip is inline). The internal optimization (single Button per option) already halved the per-strip cost.

## Deviations from Plan

None - plan executed as written. The plan anticipated that Menu lazy mount might be needed, but profiling showed it was already the Chakra v3 default.

## Issues Encountered

- The 40% total DOM reduction target was not fully met (achieved 26.7%). The remaining overhead comes from the settings page.tsx rendering both mobile and desktop layouts (the mobile `display:none` layout still mounts all sections including CategoriesSection). This is a page-level architectural issue, not a category tree issue. The category tree itself was optimized by 50%+ in button count.

## Additional Finding: Mobile Layout Double-Mount

The settings page renders two layouts:
- Mobile: `<Box display={{ base: "block", md: "none" }}>` with ALL sections stacked
- Desktop: `<Box display={{ base: "none", md: "block" }}>` with conditional rendering

On desktop, the mobile layout is hidden but fully mounted (~3,000 DOM nodes). This doubles CategoriesSection rendering. Fixing this would require either a mobile section picker/tabs or JS-based breakpoint detection (useMediaQuery with hydration-safe implementation). This is out of scope for the category tree optimization but documented as a future optimization target.

## User Setup Required

None - no external service configuration required.

## Next Steps

- Consider adding a mobile section picker to settings page.tsx to avoid mounting all sections on both layouts
- Monitor render performance as category count grows (currently 37 categories)

---
*Phase: quick-16*
*Completed: 2026-02-20*
