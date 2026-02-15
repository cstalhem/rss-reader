---
phase: 07-ollama-configuration-ui
plan: 03
subsystem: ui
tags: [ollama, chakra-ui, sse-streaming, model-management, download-progress]

# Dependency graph
requires:
  - phase: 07-ollama-configuration-ui
    plan: 01
    provides: "SSE pull endpoint, cancel endpoint, download-status endpoint, delete endpoint"
  - phase: 07-ollama-configuration-ui
    plan: 02
    provides: "OllamaSection, useOllamaModels, api.ts functions, types, SettingsSidebar"
provides:
  - "useModelPull hook with SSE streaming via fetch+ReadableStream, cancel, and navigate-away resilience"
  - "ModelPullProgress component with inline progress bar, speed, and cancel button"
  - "ModelManagement component with 5 curated models, Installed badges, Pull/Delete actions, custom model input"
  - "Download indicator (pulsing dot) on Ollama sidebar tab during active downloads"
affects: [frontend-settings, frontend-model-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: [sse-via-fetch-readable-stream, abort-controller-cancel, rolling-speed-window, pulsing-dot-indicator]

key-files:
  created:
    - frontend/src/hooks/useModelPull.ts
    - frontend/src/components/settings/ModelPullProgress.tsx
    - frontend/src/components/settings/ModelManagement.tsx
  modified:
    - frontend/src/components/settings/OllamaSection.tsx
    - frontend/src/components/settings/SettingsSidebar.tsx

key-decisions:
  - "fetch+ReadableStream for SSE consumption (not EventSource) because pull endpoint is POST"
  - "Separate pullingModel state tracks which model row shows progress (since only one pull at a time)"
  - "Pulsing dot via Emotion keyframes for download indicator, matching existing ArticleRow animation pattern"

patterns-established:
  - "SSE via fetch: POST + getReader + TextDecoder + buffer splitting for SSE stream parsing"
  - "Navigate-away resilience: check download-status on mount, fall back to polling when SSE stream lost"
  - "Rolling speed window: 2s sample buffer for download speed calculation"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 7 Plan 3: Model Download Management UI Summary

**Model download/delete management with SSE streaming progress bar, curated model suggestions with Installed badges, and pulsing download indicator on settings sidebar**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T15:44:11Z
- **Completed:** 2026-02-15T15:48:11Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created useModelPull hook with SSE streaming via fetch+ReadableStream, AbortController cancel, and navigate-away resilience via download-status polling
- Built ModelManagement component with 5 curated model suggestions showing name, size, description, and Installed badges for downloaded models
- Added inline progress bar with percentage, speed, and cancel button during downloads
- Custom model input allows pulling arbitrary models by name
- Delete with confirmation dialog prevents removing active models
- Pulsing dot indicator on Ollama sidebar tab when download is in progress

## Task Commits

Each task was committed atomically:

1. **Task 1: Model pull hook with SSE streaming and download status** - `888d63f` (feat)
2. **Task 2: Model management UI and download indicator** - `b803ab1` (feat)

## Files Created/Modified
- `frontend/src/hooks/useModelPull.ts` - SSE streaming hook with fetch+ReadableStream, cancel via AbortController, navigate-away polling
- `frontend/src/components/settings/ModelPullProgress.tsx` - Inline progress bar with percentage, speed, and cancel button
- `frontend/src/components/settings/ModelManagement.tsx` - Curated model list, installed badges, pull/delete actions, custom model input, delete confirmation dialog
- `frontend/src/components/settings/OllamaSection.tsx` - Integrates ModelManagement between ModelSelector and SystemPrompts
- `frontend/src/components/settings/SettingsSidebar.tsx` - Download status polling (3s) with pulsing dot indicator on Ollama tab

## Decisions Made
- Used `fetch()` with `ReadableStream.getReader()` for SSE consumption instead of `EventSource`, since the pull endpoint is POST (EventSource only supports GET)
- Tracked `pullingModel` via separate state to identify which model row should show the progress bar, since only one download can be active at a time
- Used Emotion `keyframes` tagged template for the pulsing dot animation, matching the pattern established in `ArticleRow.tsx`
- Used separate query key `sidebar-download-status` for sidebar polling to avoid interfering with `useModelPull`'s own `download-status` query

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused isPullingModel helper function**
- **Found during:** Task 2 (ModelManagement component)
- **Issue:** Initially wrote a helper `isPullingModel()` that was superseded by inline `pullingModel === name` checks; the unused function triggered ESLint warnings
- **Fix:** Removed the dead function
- **Files modified:** frontend/src/components/settings/ModelManagement.tsx
- **Verification:** ESLint passes clean on the file
- **Committed in:** b803ab1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial cleanup of own code. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 7 (Ollama Configuration UI) is now fully complete
- All 3 plans delivered: backend API (07-01), settings UI (07-02), model management (07-03)
- Full model lifecycle available: discover, download with progress, select for scoring, delete unused models

## Self-Check: PASSED

- useModelPull.ts: FOUND
- ModelPullProgress.tsx: FOUND
- ModelManagement.tsx: FOUND
- OllamaSection.tsx: FOUND
- SettingsSidebar.tsx: FOUND
- 07-03-SUMMARY.md: FOUND
- Commit 888d63f: FOUND
- Commit b803ab1: FOUND

---
*Phase: 07-ollama-configuration-ui*
*Completed: 2026-02-15*
