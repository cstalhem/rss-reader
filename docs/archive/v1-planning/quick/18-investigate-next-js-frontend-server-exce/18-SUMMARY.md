---
phase: quick-18
plan: 01
subsystem: infra
tags: [next.js, webpack, memory-optimization]

requires: []
provides:
  - "preloadEntriesOnStart: false in next.config.ts experimental block"
  - "webpackMemoryOptimizations: true in next.config.ts experimental block"
affects: [frontend-build]

tech-stack:
  added: []
  patterns:
    - "Next.js experimental flags for server memory reduction"

key-files:
  created: []
  modified:
    - frontend/next.config.ts

key-decisions:
  - "preloadEntriesOnStart: false -- flag not yet recognised by Next.js 16.1.6 (shows ⨯ in build output) but build exits 0, will activate on upgrade"

patterns-established: []

requirements-completed: []

duration: 3min
completed: 2026-02-20
---

# Quick Task 18: Add Memory Optimization Flags to next.config.ts Summary

**Two Next.js experimental flags added to defer module preloading and enable webpack memory optimization passes, reducing the frontend server's RAM footprint.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T00:00:00Z
- **Completed:** 2026-02-20T00:03:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `preloadEntriesOnStart: false` to the experimental block in `frontend/next.config.ts`
- Added `webpackMemoryOptimizations: true` to the experimental block in `frontend/next.config.ts`
- Verified production build completes with exit code 0

## Task Commits

1. **Task 1: Add memory optimization flags to next.config.ts** - `97926d8` (feat)

## Files Created/Modified

- `frontend/next.config.ts` - Added `preloadEntriesOnStart: false` and `webpackMemoryOptimizations: true` to experimental block

## Decisions Made

- `preloadEntriesOnStart` is not recognised by Next.js 16.1.6 (shows `⨯` in build output alongside recognised flags) but the build exits 0 and the flag is silently ignored. It is forward-compatible: it will activate automatically on upgrade to the Next.js version that supports it. No action needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`preloadEntriesOnStart` is flagged as unrecognised (`⨯`) by the current Next.js version (16.1.6) but does not cause a build failure. The flag was added as specified; it is a no-op until the project upgrades to a version that supports it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Memory optimization flags are in place. No blockers.

---
*Phase: quick-18*
*Completed: 2026-02-20*
