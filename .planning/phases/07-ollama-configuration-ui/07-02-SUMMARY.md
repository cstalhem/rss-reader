---
phase: 07-ollama-configuration-ui
plan: 02
subsystem: ui
tags: [ollama, chakra-ui, tanstack-query, settings, model-selection, health-monitoring]

# Dependency graph
requires:
  - phase: 07-ollama-configuration-ui
    plan: 01
    provides: "9 /api/ollama/* endpoints, two-tier config pattern"
  - phase: 05-scoring-ui
    provides: "useScoringStatus hook for active scoring detection"
provides:
  - "OllamaSection component replacing OllamaPlaceholder in settings"
  - "OllamaHealthBadge with connected/disconnected status, latency, and version"
  - "ModelSelector with single/split toggle, NativeSelect dropdowns, RAM warning, Save button"
  - "SystemPrompts with collapsible read-only prompt display"
  - "RescoreButton for triggering re-evaluation after model changes"
  - "useOllamaHealth hook with 20s conditional polling"
  - "useOllamaModels hook with window focus refetch"
  - "useOllamaConfig hook with save mutation and query invalidation"
  - "7 API client functions for Ollama endpoints"
  - "5 Ollama types (OllamaHealth, OllamaModel, OllamaConfig, OllamaPrompts, OllamaConfigSaveResult)"
affects: [07-03, frontend-model-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [useReducer-for-form-overlay, useState-initializer-for-initial-capture, conditional-polling-with-enabled-param]

key-files:
  created:
    - frontend/src/components/settings/OllamaSection.tsx
    - frontend/src/components/settings/OllamaHealthBadge.tsx
    - frontend/src/components/settings/ModelSelector.tsx
    - frontend/src/components/settings/SystemPrompts.tsx
    - frontend/src/components/settings/RescoreButton.tsx
    - frontend/src/hooks/useOllamaHealth.ts
    - frontend/src/hooks/useOllamaModels.ts
    - frontend/src/hooks/useOllamaConfig.ts
  modified:
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts
    - frontend/src/app/settings/page.tsx

key-decisions:
  - "useReducer for local form state overlay to avoid setState-in-effect lint violations"
  - "useState initializer to capture initial config for dirty detection instead of useRef (avoids ref-during-render lint error)"
  - "NativeSelect over Select.Root for simpler model dropdown UX"
  - "Collapsible.Root for system prompts instead of custom toggle state"

patterns-established:
  - "Form overlay pattern: useReducer(null) tracks local edits, falls back to server query data when null"
  - "Conditional hook polling: pass enabled/isVisible to hooks, they control refetchInterval internally"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 7 Plan 2: Ollama Settings UI Summary

**Ollama settings section with health badge (20s polling), model selector with single/split toggle, collapsible system prompts, and re-score button for unread article re-evaluation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T15:35:55Z
- **Completed:** 2026-02-15T15:41:18Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Built complete Ollama settings UI replacing the placeholder component
- Health badge auto-refreshes every 20s when visible, shows connection status with latency and version
- Model selector supports single model (default) and split models with RAM warning, explicit Save button
- System prompts displayed in collapsible sections with mono font, read-only
- Re-score button enables after model config changes, triggers save with rescore=true
- All 7 Ollama API client functions and 5 types added to shared modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, API functions, and data hooks** - `3dd1304` (feat)
2. **Task 2: Ollama settings UI components** - `3e55ab1` (feat)

## Files Created/Modified
- `frontend/src/lib/types.ts` - Added 5 Ollama-related interfaces
- `frontend/src/lib/api.ts` - Added 7 API functions for Ollama endpoints
- `frontend/src/hooks/useOllamaHealth.ts` - TanStack Query hook with 20s conditional polling
- `frontend/src/hooks/useOllamaModels.ts` - TanStack Query hook with 30s staleTime
- `frontend/src/hooks/useOllamaConfig.ts` - Config query + save mutation with invalidation
- `frontend/src/components/settings/OllamaSection.tsx` - Main section composing all sub-components
- `frontend/src/components/settings/OllamaHealthBadge.tsx` - Connection status badge
- `frontend/src/components/settings/ModelSelector.tsx` - Model dropdown(s) with save
- `frontend/src/components/settings/SystemPrompts.tsx` - Collapsible read-only prompt display
- `frontend/src/components/settings/RescoreButton.tsx` - Re-evaluate button with change detection
- `frontend/src/app/settings/page.tsx` - Replaced OllamaPlaceholder with OllamaSection

## Decisions Made
- Used `useReducer` for local form state overlay instead of `useState` + `useEffect` syncing, avoiding the `set-state-in-effect` ESLint violation while keeping the same functional behavior
- Used `useState` initializer function to capture initial config snapshot for dirty detection, avoiding `useRef` during render which triggers the `refs` lint rule
- Chose `NativeSelect` over `Select.Root` for model dropdowns -- simpler markup, native `<select>` behavior sufficient for a short list of models
- Used Chakra `Collapsible.Root` / `Collapsible.Content` / `Collapsible.Indicator` for system prompts -- built-in animation and state management

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect icon name LuAlertTriangle -> LuTriangleAlert**
- **Found during:** Task 2 (ModelSelector component)
- **Issue:** `LuAlertTriangle` does not exist in the installed react-icons version; the correct export is `LuTriangleAlert`
- **Fix:** Changed import and usage to `LuTriangleAlert`
- **Files modified:** frontend/src/components/settings/ModelSelector.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 3e55ab1 (Task 2 commit)

**2. [Rule 1 - Bug] Restructured form state management to avoid lint violations**
- **Found during:** Task 2 (OllamaSection and RescoreButton)
- **Issue:** Initial implementation used `useState` + `useEffect` for syncing server config to local state (set-state-in-effect) and `useRef.current` during render (refs-during-render), both flagged by ESLint
- **Fix:** OllamaSection: replaced with `useReducer(null)` overlay pattern. RescoreButton: replaced `useRef` with `useState` initializer function
- **Files modified:** frontend/src/components/settings/OllamaSection.tsx, frontend/src/components/settings/RescoreButton.tsx
- **Verification:** ESLint passes cleanly on all new files
- **Committed in:** 3e55ab1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

Pre-existing lint errors in other files (AddFeedDialog, InterestsSection, useLocalStorage, useCompletingArticles, FeedRow, color-mode, useArticles) -- all unrelated to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Ollama settings UI components ready for model management features (07-03)
- API client functions for model pull/delete/download-status already added (used by 07-03)
- Health polling and model list hooks available for model management UI

## Self-Check: PASSED

- OllamaSection.tsx: FOUND
- OllamaHealthBadge.tsx: FOUND
- ModelSelector.tsx: FOUND
- SystemPrompts.tsx: FOUND
- RescoreButton.tsx: FOUND
- useOllamaHealth.ts: FOUND
- useOllamaModels.ts: FOUND
- useOllamaConfig.ts: FOUND
- Commit 3dd1304: FOUND
- Commit 3e55ab1: FOUND

---
*Phase: 07-ollama-configuration-ui*
*Completed: 2026-02-15*
