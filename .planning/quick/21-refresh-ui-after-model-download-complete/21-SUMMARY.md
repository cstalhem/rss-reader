---
phase: quick-21
plan: 01
subsystem: ui
tags: [tanstack-query, ollama, invalidation, model-download]

# Dependency graph
requires:
  - phase: quick-20
    provides: Unified TanStack Query cache for download status
provides:
  - Reliable post-download model list refresh with safety follow-up invalidation
  - Self-sufficient download status query in ModelSelector (queryFn on cold cache)
affects: [ollama-settings, model-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [safety follow-up invalidation for async registration delays]

key-files:
  created: []
  modified:
    - frontend/src/hooks/useModelPull.ts
    - frontend/src/components/settings/ModelSelector.tsx

key-decisions:
  - "Safety follow-up invalidation (1500ms SSE, 1000ms poll) rather than single delayed refetch"

patterns-established:
  - "Safety follow-up invalidation: when external service needs registration time, schedule a second invalidateQueries after a longer delay"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-02-21
---

# Quick Task 21: Refresh UI After Model Download Complete Summary

**Dual-path model list invalidation with safety follow-up delays, plus queryFn fix for ModelSelector download status query**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T20:10:12Z
- **Completed:** 2026-02-21T20:13:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Both download completion paths (SSE and poll-recovery) now trigger model list invalidation twice: immediately and after a safety delay
- ModelSelector download status query now includes queryFn, eliminating cold-cache runtime error risk
- Build compiles cleanly (TypeScript passes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Ensure reliable model list refresh on download completion** - `e077363` (feat)
2. **Task 2: Fix ModelSelector missing queryFn anti-pattern** - `8c5b3d4` (fix)

## Files Created/Modified
- `frontend/src/hooks/useModelPull.ts` - Added MODEL_REGISTRATION_SAFETY_DELAY constant, safety follow-up invalidation in SSE success path (1500ms) and poll-recovery path (1000ms)
- `frontend/src/components/settings/ModelSelector.tsx` - Added fetchDownloadStatus import and queryFn to download status useQuery

## Decisions Made
- Used safety follow-up invalidation at 1500ms (SSE) and 1000ms (poll) rather than increasing the primary delay, preserving the fast 500ms UI cleanup while ensuring Ollama registration catches up
- Poll-recovery uses DOWNLOAD_STATUS_POLL_INTERVAL (1000ms) for its follow-up since the poll cycle already introduces delay

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `bun run build` fails at static page generation (`/_not-found` pre-render error) due to a pre-existing Next.js 16 internal bug. TypeScript compilation succeeds with no errors from our changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Model download UI refresh is now reliable across all completion paths
- No blockers for future Ollama-related work

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Quick Task: 21-refresh-ui-after-model-download-complete*
*Completed: 2026-02-21*
