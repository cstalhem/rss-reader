---
phase: 09-frontend-codebase-evaluation-simplification
plan: 01
subsystem: ui
tags: [tanstack-query, typescript, refactoring]

# Dependency graph
requires: []
provides:
  - Centralized query key factory (queryKeys.ts)
  - MutationCache global error handler with meta type registration
  - Cross-file named constants (constants.ts)
  - Fixed file organization (types in types.ts, functions in utils.ts)
  - Single API_BASE_URL export
affects: [09-02, 09-03, 09-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query key factory pattern: queryKeys.domain.key for all TanStack Query keys"
    - "MutationCache.onError global toast with meta.handlesOwnErrors opt-out"
    - "Module augmentation for @tanstack/react-query Register interface"

key-files:
  created:
    - frontend/src/lib/queryKeys.ts
    - frontend/src/lib/constants.ts
  modified:
    - frontend/src/lib/queryClient.ts
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/utils.ts
    - frontend/src/hooks/useModelPull.ts
    - frontend/src/components/settings/SettingsSidebar.tsx
    - frontend/src/components/article/ArticleList.tsx

key-decisions:
  - "Query key factory uses plain object with as const (no class/function wrappers)"
  - "MutationCache meta uses Register interface augmentation for type-safe meta access"

patterns-established:
  - "Query keys centralized in queryKeys.ts factory object"
  - "Global mutation error toast via MutationCache.onError (opt-out with meta.handlesOwnErrors)"
  - "Cross-file constants in lib/constants.ts, single-use constants stay co-located"

requirements-completed: [SUCCESS_CRITERIA_1, SUCCESS_CRITERIA_3, SUCCESS_CRITERIA_8]

# Metrics
duration: 3.2min
completed: 2026-02-19
---

# Phase 09 Plan 01: Infrastructure Foundations Summary

**Query key factory, MutationCache global error handler, shared constants, and file organization fixes across lib/ layer**

## Performance

- **Duration:** 3.2 min
- **Started:** 2026-02-19T12:49:30Z
- **Completed:** 2026-02-19T12:52:44Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created centralized query key factory covering all 12 unique query key patterns across the codebase
- Added MutationCache.onError global error handler with TypeScript Register meta type augmentation
- Centralized 5 cross-file constants (HEADER_HEIGHT, SIDEBAR_WIDTH_COLLAPSED/EXPANDED, NEW_COUNT_POLL_INTERVAL, HIGH_SCORE_THRESHOLD)
- Moved ScoringStatus, DownloadStatus, FetchArticlesParams interfaces from api.ts to types.ts
- Moved parseSortOption runtime function from types.ts to utils.ts
- Eliminated duplicate API_BASE_URL definition (was in both api.ts and useModelPull.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create query key factory, MutationCache global error handler, and meta type registration** - `1697df7` (feat)
2. **Task 2: Create shared constants, fix file organization misplacements, and deduplicate API_BASE_URL** - `21de209` (refactor)

## Files Created/Modified
- `frontend/src/lib/queryKeys.ts` - Centralized query key factory with domain-grouped keys
- `frontend/src/lib/queryClient.ts` - Added MutationCache with global error toast handler
- `frontend/src/lib/constants.ts` - Cross-file named constants for layout dimensions and thresholds
- `frontend/src/lib/types.ts` - Received ScoringStatus, DownloadStatus, FetchArticlesParams from api.ts
- `frontend/src/lib/api.ts` - Exported API_BASE_URL, removed interface definitions moved to types.ts
- `frontend/src/lib/utils.ts` - Received parseSortOption function from types.ts
- `frontend/src/hooks/useModelPull.ts` - Import API_BASE_URL from api.ts instead of local duplicate
- `frontend/src/components/settings/SettingsSidebar.tsx` - Import DownloadStatus from types.ts
- `frontend/src/components/article/ArticleList.tsx` - Import parseSortOption from utils.ts

## Decisions Made
- Query key factory uses plain `as const` object (no class or function wrapper) for simplicity
- MutationCache meta types use module augmentation via `Register` interface for type-safe access without casting
- Constants file only contains cross-file constants (used in 2+ files); single-use constants stay co-located per AGENTS.md convention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- queryKeys.ts ready for Plans 02-04 to import and replace inline string literals
- MutationCache ready for Plans 02-04 to add meta tags to mutations
- constants.ts ready for Plan 03 to replace hardcoded values in components
- All lib/ files correctly organized for subsequent refactoring

## Self-Check: PASSED

All created files verified on disk. All commit hashes found in git log.

---
*Phase: 09-frontend-codebase-evaluation-simplification*
*Completed: 2026-02-19*
