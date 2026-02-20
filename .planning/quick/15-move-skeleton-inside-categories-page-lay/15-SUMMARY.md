---
phase: quick-15
plan: 01
subsystem: ui
tags: [react, skeleton, loading-state, categories]

requires:
  - phase: quick-14
    provides: CategoriesTreeSkeleton component for tree loading state
provides:
  - Inline skeleton loading in categories page (page chrome renders immediately)
affects: []

tech-stack:
  added: []
  patterns: [inline-skeleton-loading]

key-files:
  created: []
  modified:
    - frontend/src/app/settings/page.tsx
    - frontend/src/components/settings/CategoriesSection.tsx
    - frontend/src/components/settings/CategoriesTreeSkeleton.tsx

key-decisions:
  - "useDeferredValue for section switching: sidebar reads activeSection (immediate), content reads deferredSection (deferred)"
  - "Skeleton shown during isPending && activeSection === categories — targets the render bottleneck, not data fetching"
  - "Strip title/search skeletons from CategoriesTreeSkeleton since real chrome now renders above the skeleton"

patterns-established:
  - "useDeferredValue for splitting urgent UI updates (sidebar) from expensive renders (content)"
  - "Inline skeleton: render page chrome immediately, show skeleton only in data-dependent areas"

requirements-completed: [QUICK-15]

duration: 1.6min
completed: 2026-02-20
---

# Quick 15: Move Skeleton Inside Categories Page Layout Summary

**useDeferredValue splits sidebar update (instant) from heavy categories render (deferred), showing skeleton during the transition**

## Performance

- **Duration:** ~15 min (including diagnosis and iteration)
- **Files modified:** 3

## Accomplishments
- Sidebar highlights the selected section immediately on click (no delay)
- Categories skeleton shows during the deferred render (~870ms)
- Skeleton replaced by real content once React finishes rendering
- Other section switches unaffected (they render fast, no skeleton needed)
- CategoriesSection isLoading branch still works for cold-cache data fetches
- Hidden categories section does not flash during loading

## Root Cause Discovery
The original skeleton approach targeted `isLoading` (data fetching), but the ~870ms delay was pure React render time. TanStack Query returns cached data synchronously after the first visit, so `isLoading` was never true. The fix needed to target the render bottleneck, not the data layer.

## Files Created/Modified
- `frontend/src/app/settings/page.tsx` - Added useDeferredValue: sidebar reads `activeSection` (immediate), content reads `deferredSection` (deferred). Shows CategoriesTreeSkeleton when `isPending && activeSection === "categories"`.
- `frontend/src/components/settings/CategoriesSection.tsx` - Moved isLoading skeleton inline (page chrome renders above skeleton)
- `frontend/src/components/settings/CategoriesTreeSkeleton.tsx` - Stripped title and search skeletons (now redundant since used inline)

## Decisions Made
- `useDeferredValue` over `useTransition`: useTransition defers the entire state update (sidebar wouldn't highlight immediately). useDeferredValue lets us split the read — sidebar reads the immediate value, content reads the deferred value.
- Skeleton only for categories: it's the only section heavy enough to warrant a loading state during render.

## Issues Encountered
- Initial `useTransition` approach failed — it deferred the sidebar highlight too since both sidebar and content read the same state. Switched to `useDeferredValue` which splits reads.
- Executor's original isLoading-based skeleton never showed because TanStack Query cache made isLoading always false after first visit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Categories page loading UX is complete
- No blockers

---
*Phase: quick-15*
*Completed: 2026-02-20*
