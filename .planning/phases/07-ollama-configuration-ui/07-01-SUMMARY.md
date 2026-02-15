---
phase: 07-ollama-configuration-ui
plan: 01
subsystem: api
tags: [ollama, fastapi, sse, sqlmodel, two-tier-config, model-management]

# Dependency graph
requires:
  - phase: 04-llm-scoring-pipeline
    provides: "scoring.py and scoring_queue.py with categorize/score pipeline"
  - phase: 05-scoring-ui
    provides: "scoring status API and frontend polling"
provides:
  - "ollama_service.py wrapping all Ollama API interactions"
  - "9 /api/ollama/* endpoints (health, models, pull, cancel, delete, download-status, config, prompts)"
  - "Two-tier config pattern: UserPreferences for runtime model choices, Settings for infrastructure"
  - "Priority-based scoring queue with rescore_mode support"
  - "UserPreferences extended with ollama model fields"
  - "Article extended with scoring_priority and rescore_mode"
affects: [07-02, 07-03, frontend-ollama-settings]

# Tech tracking
tech-stack:
  added: [httpx (health check), ollama AsyncClient (model management)]
  patterns: [two-tier-config, sse-streaming, module-level-state-for-download-tracking]

key-files:
  created:
    - backend/src/backend/ollama_service.py
  modified:
    - backend/src/backend/models.py
    - backend/src/backend/database.py
    - backend/src/backend/main.py
    - backend/src/backend/scoring.py
    - backend/src/backend/scoring_queue.py

key-decisions:
  - "Two-tier config: UserPreferences for runtime model names, Pydantic Settings for host/thinking/infrastructure"
  - "Module-level state for download tracking (safe in single-worker asyncio)"
  - "SSE streaming for pull progress with data: {json} format"
  - "Score-only re-scoring skips categorization when only scoring model changed"

patterns-established:
  - "Two-tier config: scoring_queue reads model names from DB per-batch, falls back to Settings defaults"
  - "Explicit model parameter: scoring.py functions accept model name as parameter, callers resolve it"
  - "Priority ordering: scoring_priority DESC, published_at ASC in queue query"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 7 Plan 1: Backend API for Ollama Configuration Summary

**Ollama service layer with 9 API endpoints, two-tier config pattern (DB runtime + YAML defaults), and priority-aware scoring queue with score-only re-scoring mode**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T15:29:13Z
- **Completed:** 2026-02-15T15:33:19Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created ollama_service.py encapsulating all Ollama API interactions (health, models, pull stream, cancel, delete, download status)
- Added 9 /api/ollama/* endpoints with SSE streaming for model downloads
- Implemented two-tier config: model names read from UserPreferences per-batch, infrastructure from Pydantic Settings
- Scoring queue now orders by priority (re-scored articles first) and handles score-only mode (skip categorization)

## Task Commits

Each task was committed atomically:

1. **Task 1: Ollama service layer, DB migration, and model extension** - `ce193ad` (feat)
2. **Task 2: API endpoints and two-tier scoring pipeline** - `60d5cb4` (feat)

## Files Created/Modified
- `backend/src/backend/ollama_service.py` - Ollama API wrapper (health, models, pull, delete, download state)
- `backend/src/backend/models.py` - UserPreferences +3 fields (ollama model config), Article +2 fields (rescore support)
- `backend/src/backend/database.py` - Migration for 5 new columns across both tables
- `backend/src/backend/main.py` - All 9 /api/ollama/* endpoints with Pydantic request/response models
- `backend/src/backend/scoring.py` - Functions accept explicit model parameter
- `backend/src/backend/scoring_queue.py` - Two-tier config reads, priority ordering, rescore_mode handling

## Decisions Made
- Two-tier config pattern: UserPreferences stores runtime model choices, Pydantic Settings provides infrastructure defaults and fallback values
- Module-level dict for download state tracking -- safe in single-worker asyncio, avoids DB overhead for ephemeral state
- SSE format `data: {json}\n\n` for pull progress stream, matching standard EventSource format
- Re-score mode comparison: categorization model change triggers "full" re-score, scoring-only change triggers "score_only"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures (6/14) unrelated to changes -- tests written before scoring pipeline filtering was added (test articles lack `scoring_state="scored"` and `composite_score`). Verified by running same tests on previous commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All backend APIs ready for frontend plans (07-02 settings UI, 07-03 model management UI)
- Two-tier config pattern established and tested via route registration verification
- SSE streaming endpoint ready for frontend EventSource consumption

## Self-Check: PASSED

- ollama_service.py: FOUND
- 07-01-SUMMARY.md: FOUND
- Commit ce193ad: FOUND
- Commit 60d5cb4: FOUND

---
*Phase: 07-ollama-configuration-ui*
*Completed: 2026-02-15*
