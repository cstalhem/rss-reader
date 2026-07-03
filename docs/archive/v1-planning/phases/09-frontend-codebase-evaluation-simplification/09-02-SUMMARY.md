---
phase: 09-frontend-codebase-evaluation-simplification
plan: 02
subsystem: ui
tags: [tanstack-query, typescript, refactoring, hooks]

# Dependency graph
requires:
  - phase: 09-01
    provides: Query key factory (queryKeys.ts), MutationCache global error handler, shared constants
provides:
  - All hooks using centralized queryKeys.* references
  - Mutation meta tags (errorTitle, handlesOwnErrors) on all mutations
  - Direct mutation object exposure from useCategories
  - Named constants for all single-file magic numbers
  - useRenameState shared hook for rename state management
affects: [09-03, 09-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation meta.errorTitle for global MutationCache error toasts"
    - "Mutation meta.handlesOwnErrors for optimistic rollback mutations"
    - "Direct mutation object exposure instead of thin wrapper functions"
    - "useRenameState shared hook for rename state across row components"

key-files:
  created:
    - frontend/src/hooks/useRenameState.ts
  modified:
    - frontend/src/hooks/useCategories.ts
    - frontend/src/hooks/useFeedMutations.ts
    - frontend/src/hooks/usePreferences.ts
    - frontend/src/hooks/useOllamaConfig.ts
    - frontend/src/hooks/useArticles.ts
    - frontend/src/hooks/useScoringStatus.ts
    - frontend/src/hooks/useOllamaHealth.ts
    - frontend/src/hooks/useOllamaModels.ts
    - frontend/src/hooks/useModelPull.ts
    - frontend/src/hooks/useFeeds.ts
    - frontend/src/hooks/useCompletingArticles.ts
    - frontend/src/hooks/useAutoMarkAsRead.ts

key-decisions:
  - "Keep updateCategory helper wrapper for auto-acknowledge logic (behavior, not just delegation)"
  - "Convert mutation onSuccess to onSettled for cache freshness on both success and error"
  - "Optimistic rollback mutations (updateCategory, reorderFeeds) use handlesOwnErrors meta flag"

patterns-established:
  - "All hooks import queryKeys from @/lib/queryKeys for query key references"
  - "All mutations without custom error handling use meta.errorTitle for global toast"
  - "Single-file magic numbers are named constants at top of their respective hook files"

requirements-completed: [SUCCESS_CRITERIA_1, SUCCESS_CRITERIA_2, SUCCESS_CRITERIA_3, SUCCESS_CRITERIA_5, SUCCESS_CRITERIA_6, SUCCESS_CRITERIA_8]

# Metrics
duration: 4.5min
completed: 2026-02-19
---

# Phase 09 Plan 02: Hook Layer Refactoring Summary

**Centralized query keys, global error handling via MutationCache meta, direct mutation object exposure, and useRenameState shared hook across all 13 hooks**

## Performance

- **Duration:** 4.5 min
- **Started:** 2026-02-19T12:55:13Z
- **Completed:** 2026-02-19T12:59:46Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Replaced all inline query key strings with queryKeys.* references across 13 hook files (zero inline strings remain)
- Removed per-mutation onError toast boilerplate from 10 mutations, replaced with meta.errorTitle for MutationCache
- Exposed mutation objects directly from useCategories instead of thin wrapper functions
- Named 10 single-file magic numbers as constants (PAGE_SIZE, poll intervals, delays)
- Created useRenameState hook extracting shared rename pattern from 4 category row + 1 feed row components
- Removed redundant category newCount invalidation calls (prefix matching handles subcategories)
- Removed dead savedConfig alias from useOllamaConfig

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor useCategories -- mutation exposure, query keys, error handling, redundant invalidation** - `c074aae` (refactor)
2. **Task 2: Refactor all other hooks -- query keys, error handling, magic numbers, savedConfig removal** - `8a8072e` (refactor)
3. **Task 3: Create useRenameState hook** - `316d66e` (feat)

## Files Created/Modified
- `frontend/src/hooks/useRenameState.ts` - New shared rename state hook (isRenaming, value, inputRef, submit/cancel)
- `frontend/src/hooks/useCategories.ts` - Query keys, meta tags, direct mutation exposure, removed redundant invalidation
- `frontend/src/hooks/useFeedMutations.ts` - Query keys, meta tags for all 5 mutations
- `frontend/src/hooks/usePreferences.ts` - Query keys, meta tag, direct mutation object return
- `frontend/src/hooks/useOllamaConfig.ts` - Query keys, meta tag, removed savedConfig alias
- `frontend/src/hooks/useArticles.ts` - Query keys, meta tag, named constants (PAGE_SIZE, poll intervals)
- `frontend/src/hooks/useScoringStatus.ts` - Query keys, named constants (active/idle intervals)
- `frontend/src/hooks/useOllamaHealth.ts` - Query keys, named constant (HEALTH_POLL_INTERVAL)
- `frontend/src/hooks/useOllamaModels.ts` - Query keys
- `frontend/src/hooks/useModelPull.ts` - Query keys, named constants (poll interval, delay)
- `frontend/src/hooks/useFeeds.ts` - Query keys
- `frontend/src/hooks/useCompletingArticles.ts` - Named constant (COMPLETING_ARTICLE_DURATION)
- `frontend/src/hooks/useAutoMarkAsRead.ts` - Named constant (AUTO_MARK_READ_DELAY)

## Decisions Made
- Kept updateCategory as the one wrapper function that adds auto-acknowledge behavior (is_seen: true on weight change) -- all other wrappers removed
- Converted onSuccess to onSettled on mutations for cache consistency (invalidate even on error)
- Used meta.handlesOwnErrors on updateCategory and reorderFeeds (both have optimistic rollback with manual toast/silent recovery)
- Kept toaster import in useCategories.ts for the one remaining usage in updateCategoryMutation optimistic rollback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All hooks now use consistent patterns (queryKeys, meta tags, named constants)
- Plan 03 must update consumer components to use new mutation object return shapes
- Expected consumer errors: CategoriesSection.tsx (wrapper functions removed), InterestsSection.tsx (updatePreferences/isUpdating removed), OllamaSection.tsx (savedConfig removed)

## Self-Check: PASSED

All created files verified on disk. All commit hashes found in git log.

---
*Phase: 09-frontend-codebase-evaluation-simplification*
*Completed: 2026-02-19*
