---
phase: 04-llm-content-curation
plan: 01
subsystem: database, api
tags: [sqlmodel, ollama, llm, pydantic, fastapi, typescript]

# Dependency graph
requires:
  - phase: 03-feed-management
    provides: Feed and Article models, API endpoints, frontend types
provides:
  - Article model extended with 7 LLM scoring fields
  - UserPreferences model for single-user curation settings
  - GET/PUT /api/preferences endpoints for preference management
  - GET /api/categories endpoint for unique category list
  - PATCH /api/categories/{name}/weight for quick category weight updates
  - OllamaConfig in settings with host, models, and timeout
  - Ollama service in Docker Compose with persistent volume
  - Frontend types updated with Article scoring fields and UserPreferences interface
  - Frontend API functions for preferences and categories
affects: [04-02-scoring-engine, 04-03-settings-ui, 04-04-article-ui]

# Tech tracking
tech-stack:
  added: [ollama/ollama:latest Docker image]
  patterns: [JSON columns for list/dict fields, single-row preference table, case-insensitive category keys]

key-files:
  created:
    - backend/src/backend/models.py::UserPreferences
  modified:
    - backend/src/backend/models.py
    - backend/src/backend/config.py
    - backend/src/backend/main.py
    - docker-compose.yml
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts

key-decisions:
  - "Single-row UserPreferences table (this is a single-user app)"
  - "SQLAlchemy JSON columns for categories (list) and topic_weights (dict)"
  - "Case-insensitive category keys for consistency (normalized to lowercase)"
  - "No health check on Ollama service - scoring queue handles unavailability via retry"
  - "GET /api/categories returns unique categories from scored articles only"

patterns-established:
  - "JSON column pattern: Field(default=None, sa_column=Column(JSON))"
  - "model_config = {'arbitrary_types_allowed': True} for SQLModel with JSON columns"
  - "Preferences endpoint creates default preferences on first access"
  - "Category weight PATCH endpoint for quick block/boost from article tags"

# Metrics
duration: 3m 30s
completed: 2026-02-13
---

# Phase 04 Plan 01: Data Foundation Summary

**Article model extended with 7 scoring fields, UserPreferences model with CRUD endpoints, Ollama service in Docker Compose, and frontend types for LLM content curation**

## Performance

- **Duration:** 3m 30s
- **Started:** 2026-02-13T16:11:47Z
- **Completed:** 2026-02-13T16:15:17Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Extended Article model with 7 LLM scoring fields (categories, interest_score, quality_score, composite_score, score_reasoning, scoring_state, scored_at)
- Created UserPreferences model for storing interests, anti-interests, and topic weights
- Implemented GET/PUT /api/preferences endpoints with auto-creation of default preferences
- Implemented GET /api/categories endpoint to fetch unique categories from scored articles
- Implemented PATCH /api/categories/{name}/weight for quick category weight updates
- Added OllamaConfig to settings (host, categorization_model, scoring_model, timeout)
- Added Ollama service to Docker Compose with persistent volume and Docker network connectivity
- Updated frontend types with all Article scoring fields and new UserPreferences interface
- Added frontend API functions for preferences and categories

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend data models and config for LLM scoring** - `9c4d066` (feat)
2. **Task 2: Create preferences and categories API endpoints** - `15ab4b8` (feat)
3. **Task 3: Add Ollama service to Docker Compose** - `e1bd104` (feat)

## Files Created/Modified
- `backend/src/backend/models.py` - Added UserPreferences model, extended Article with 7 scoring fields
- `backend/src/backend/config.py` - Added OllamaConfig section to settings
- `backend/src/backend/main.py` - Added 4 new endpoints: GET/PUT preferences, GET categories, PATCH category weight
- `docker-compose.yml` - Added Ollama service with ollama-data volume, configured backend to connect via Docker network
- `frontend/src/lib/types.ts` - Extended Article interface with scoring fields, added UserPreferences interface
- `frontend/src/lib/api.ts` - Added 4 new API functions: fetchPreferences, updatePreferences, fetchCategories, updateCategoryWeight

## Decisions Made
- Used single-row UserPreferences table (appropriate for single-user application)
- SQLAlchemy JSON columns for categories (list[str]) and topic_weights (dict[str, str])
- Case-insensitive category keys normalized to lowercase for consistency
- No health check on Ollama service - scoring queue (Plan 02) will handle connection failures with retry
- GET /api/categories returns only categories from already-scored articles (empty list initially)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully without issues.

## User Setup Required

None - no external service configuration required. Ollama models will be pulled automatically when scoring engine starts in Plan 02.

## Next Phase Readiness

- Article model ready to receive scoring data from LLM engine
- UserPreferences model and endpoints ready for settings UI (Plan 03)
- Ollama service configured in Docker Compose, ready for LLM calls (Plan 02)
- Frontend types and API functions ready for integration in Plans 03-04
- Database will auto-migrate on next backend startup via SQLModel.metadata.create_all()

**Blockers:** None

**Note:** Backend test suite has pre-existing failures (test_root checks "/" instead of "/health"), unrelated to this plan's changes. TypeScript compilation passes successfully.

## Self-Check: PASSED

All claimed files exist:
- ✓ backend/src/backend/models.py
- ✓ backend/src/backend/config.py
- ✓ backend/src/backend/main.py
- ✓ docker-compose.yml
- ✓ frontend/src/lib/types.ts
- ✓ frontend/src/lib/api.ts

All claimed commits exist:
- ✓ 9c4d066 (Task 1)
- ✓ 15ab4b8 (Task 2)
- ✓ e1bd104 (Task 3)

---
*Phase: 04-llm-content-curation*
*Completed: 2026-02-13*
