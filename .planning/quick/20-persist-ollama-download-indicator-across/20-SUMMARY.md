---
phase: quick-20
plan: 01
subsystem: ui
tags: [tanstack-query, sse, ollama, download-progress]

requires:
  - phase: 07-ollama-configuration-ui
    provides: Model pull SSE streaming, download status polling, ModelManagement/ModelSelector components
provides:
  - Unified download status via TanStack Query cache (single source of truth across all components)
  - Cross-navigation download progress persistence
  - Sidebar model name + percentage indicator
  - Compact download progress in model selector dropdowns
affects: [ollama, settings]

tech-stack:
  added: []
  patterns: [queryClient.setQueryData for cross-component SSE state sharing]

key-files:
  created: []
  modified:
    - frontend/src/hooks/useModelPull.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/components/settings/SettingsSidebar.tsx
    - frontend/src/components/settings/ModelManagement.tsx
    - frontend/src/components/settings/ModelSelector.tsx
    - frontend/src/components/settings/ModelPullProgress.tsx

key-decisions:
  - "TanStack Query cache as single source of truth: SSE writes via setQueryData, sidebar polls same key at 3s interval for navigate-away resilience"
  - "Removed sidebarDownloadStatus separate query key; unified to single downloadStatus key"
  - "ModelManagement derives pullingModel from hook.modelName (cache) instead of local useState"
  - "Inline compact progress bar in ModelSelector (4px height + text) instead of reusing ModelPullProgress compact variant"

patterns-established:
  - "queryClient.setQueryData for sharing real-time SSE data with polling-based consumers via same cache key"

requirements-completed: [QUICK-20]

duration: 5.3min
completed: 2026-02-21
---

# Quick Task 20: Persist Ollama Download Indicator Across Navigation

**Unified download progress into TanStack Query cache for cross-component persistence with sidebar model name display and model selector inline indicators**

## Performance

- **Duration:** 5.3 min
- **Started:** 2026-02-21T19:48:47Z
- **Completed:** 2026-02-21T19:54:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Download progress persists across settings page navigation via shared TanStack Query cache
- Sidebar shows downloading model name and percentage under Ollama label with pulsing icon
- Model selector dropdowns show compact 4px progress bar when the active model is being downloaded
- Removed redundant `sidebarDownloadStatus` query key; all components read from `queryKeys.ollama.downloadStatus`
- Eliminated `pullingModel` local state in ModelManagement; derived from cache via `pullHook.modelName`

## Task Commits

1. **Task 1: Investigate and unify download state into TanStack Query cache** - `99fac47` (feat)
2. **Task 2: Show download indicator in ModelManagement rows and ModelSelector** - `59108c2` (feat)

## Files Created/Modified
- `frontend/src/hooks/useModelPull.ts` - Added setQueryData calls on every SSE progress event, export modelName derived from cache
- `frontend/src/lib/queryKeys.ts` - Removed sidebarDownloadStatus key
- `frontend/src/components/settings/SettingsSidebar.tsx` - Uses unified downloadStatus key, shows model name + percentage text
- `frontend/src/components/settings/ModelManagement.tsx` - Removed pullingModel useState, derives from pullHook.modelName
- `frontend/src/components/settings/ModelSelector.tsx` - Reads download status from cache, shows inline progress under dropdown
- `frontend/src/components/settings/ModelPullProgress.tsx` - Added compact prop for slim bar + percentage variant

## Decisions Made
- Used `queryClient.setQueryData` in SSE stream handler to write progress to cache, making it available to all components reading the same key without React Context or global store
- Sidebar continues its 3s polling via `refetchInterval` which provides navigate-away resilience (backend confirms active download)
- Inline progress bar in ModelSelector uses raw Box elements (4px height) instead of ModelPullProgress compact variant to keep the rendering minimal
- No separate query for scoring model download indicator in separate-models mode -- only shows if the scoring model differs from categorization model

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick Task: 20-persist-ollama-download-indicator-across*
*Completed: 2026-02-21*
