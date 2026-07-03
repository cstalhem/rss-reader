---
phase: 04-llm-content-curation
plan: 02
subsystem: scoring-engine, scheduler, api
tags: [ollama, llm, pydantic, apscheduler, fastapi, tenacity]

# Dependency graph
requires:
  - phase: 04-llm-content-curation
    plan: 01
    provides: Article scoring fields, UserPreferences model, Ollama config and service
provides:
  - Pydantic response schemas (CategoryResponse, ScoringResponse) for structured LLM output
  - Prompt template functions (build_categorization_prompt, build_scoring_prompt)
  - LLM scoring functions (categorize_article, score_article) with retry logic
  - Composite score computation (compute_composite_score, is_blocked, get_active_categories)
  - ScoringQueue class for background article processing
  - Scheduler integration with 30-second scoring queue job
  - Feed refresh hook to auto-enqueue new articles
  - POST /api/scoring/rescore endpoint for manual re-scoring
  - GET /api/scoring/status endpoint for queue monitoring
  - PUT /api/preferences auto-triggers re-scoring of recent articles
affects: [04-03-settings-ui, 04-04-article-ui]

# Tech tracking
tech-stack:
  added: [ollama-python client, tenacity for retry logic]
  patterns: [Two-step LLM pipeline (categorize then score), structured JSON output via Pydantic schemas, exponential backoff retry, batch processing with partial progress survival]

key-files:
  created:
    - backend/src/backend/prompts.py
    - backend/src/backend/scoring.py
    - backend/src/backend/scoring_queue.py
  modified:
    - backend/src/backend/scheduler.py
    - backend/src/backend/feeds.py
    - backend/src/backend/main.py
    - backend/pyproject.toml
    - backend/uv.lock

key-decisions:
  - "Two-step pipeline: categorize (all articles) then score (non-blocked only)"
  - "Blocked categories auto-score 0 and skip interest scoring entirely"
  - "Composite score formula: interest_score * category_multiplier * quality_multiplier (capped at 20.0)"
  - "Quality multiplier maps 0-10 to 0.5-1.0 (penalizes low quality without hiding)"
  - "Category weight mapping: blocked=0.0, low=0.5, neutral=1.0, medium=1.5, high=2.0"
  - "Active categories merged from: recent articles (30 days) + user preferences + DEFAULT_CATEGORIES"
  - "25 default seed categories to bootstrap the system"
  - "Scoring queue processes oldest articles first (published_at ASC)"
  - "Batch size of 5 articles per scheduler run (every 30 seconds)"
  - "Individual article commits (partial progress survives failures)"
  - "Failed articles marked as 'failed' without crashing queue"
  - "Tenacity retry: 3 attempts with exponential backoff (min 2s, max 10s)"
  - "Temperature 0 for deterministic LLM output"
  - "Article text truncation: 2000 chars for categorization, 3000 chars for scoring"
  - "Re-scoring triggered by preference save: last 7 days, max 100 articles"
  - "New articles from feed refresh auto-enqueued via scoring_queue import"

patterns-established:
  - "Pydantic schemas for structured LLM output with Field constraints"
  - "Prompt template functions for consistent LLM instruction format"
  - "AsyncClient(host, timeout) pattern for Ollama calls"
  - "format=Schema.model_json_schema() for structured output"
  - "Schema.model_validate_json() for parsing LLM response"
  - "@retry decorator with retry_if_exception_type for transient failures"
  - "Scoring state machine: unscored → queued → scoring → scored/failed"
  - "Circular import avoidance: import scoring_queue at call site"
  - "save_articles returns (count, ids) tuple for downstream enqueueing"
  - "session.flush() to get IDs before commit"

# Metrics
duration: 3m 56s
completed: 2026-02-13
---

# Phase 04 Plan 02: Scoring Engine Summary

**Two-step LLM pipeline with categorization, interest scoring, composite score computation, background queue processing, and automatic enqueueing from feed refresh**

## Performance

- **Duration:** 3m 56s
- **Started:** 2026-02-13T16:18:03Z
- **Completed:** 2026-02-13T16:21:59Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

### Task 1: LLM Prompt Schemas and Scoring Functions
- Created prompts.py with Pydantic v2 response schemas (CategoryResponse, ScoringResponse)
- Built prompt template functions with article truncation (2000/3000 chars)
- Shipped 25 default seed categories for system bootstrap
- Implemented categorize_article and score_article with Ollama AsyncClient
- Added tenacity retry with exponential backoff (3 attempts, 2-10s)
- Created compute_composite_score with weight mapping and quality multiplier
- Added is_blocked helper to check for blocked categories
- Added get_active_categories to merge categories from recent articles, preferences, and defaults
- Installed ollama and tenacity dependencies

### Task 2: Scoring Queue and Scheduler Integration
- Created ScoringQueue class with enqueue, enqueue_recent_for_rescoring, and process_next_batch methods
- Extended scheduler with process_scoring_queue job (every 30 seconds)
- Exported scoring_queue module-level instance for cross-module access
- Modified save_articles to return (count, ids) tuple with session.flush() for ID retrieval
- Wired feed refresh to auto-enqueue new articles via scoring_queue.enqueue_articles
- Updated PUT /api/preferences to async and trigger re-scoring after save
- Added POST /api/scoring/rescore endpoint for manual re-scoring
- Added GET /api/scoring/status endpoint returning counts by scoring_state
- Implemented two-step pipeline: categorize (Step 1) → check blocked → score if not blocked (Step 2)
- Blocked articles auto-score 0 with reasoning "Blocked: {categories}"
- Individual article commits for partial progress survival on failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LLM prompt schemas and scoring functions** - `086e7ce` (feat)
2. **Task 2: Create scoring queue and wire into scheduler + feed refresh** - `39d6eba` (feat)

## Files Created/Modified

- `backend/src/backend/prompts.py` - Created: Pydantic schemas (CategoryResponse, ScoringResponse), prompt builders, DEFAULT_CATEGORIES
- `backend/src/backend/scoring.py` - Created: LLM functions (categorize_article, score_article), composite score logic (compute_composite_score, is_blocked, get_active_categories)
- `backend/src/backend/scoring_queue.py` - Created: ScoringQueue class with three methods (enqueue, enqueue_recent_for_rescoring, process_next_batch)
- `backend/src/backend/scheduler.py` - Modified: Added scoring_queue instance, process_scoring_queue job (30s interval), updated start_scheduler log
- `backend/src/backend/feeds.py` - Modified: save_articles returns (count, ids), refresh_feed enqueues new articles via scoring_queue import
- `backend/src/backend/main.py` - Modified: create_feed enqueues articles, update_preferences async + re-scores, added POST /api/scoring/rescore and GET /api/scoring/status
- `backend/pyproject.toml` + `backend/uv.lock` - Modified: Added ollama==0.6.1 and tenacity==9.1.4 dependencies

## Decisions Made

### Pipeline Architecture
- Two-step pipeline: categorization runs on all articles, interest scoring only runs on non-blocked articles
- Blocked categories cause articles to skip Step 2 entirely and auto-score 0
- Composite score formula: `interest_score * category_multiplier * quality_multiplier` (capped at 20.0)
- Quality multiplier maps 0-10 to 0.5-1.0 (low-quality articles penalized but not hidden)
- Category weight mapping: blocked=0.0, low=0.5, neutral=1.0, medium=1.5, high=2.0

### Category Management
- 25 default seed categories for bootstrap
- Active categories merged from: recent articles (30 days) + user preferences (non-blocked) + DEFAULT_CATEGORIES
- Case-insensitive deduplication with first occurrence preservation
- Categories normalized to lowercase after LLM response

### Scoring Queue Behavior
- Process oldest articles first (published_at ASC) - prioritize old unscored content
- Batch size of 5 articles per run (every 30 seconds via scheduler)
- Individual article commits - partial progress survives failures
- Failed articles marked as "failed" and logged, queue continues processing
- Re-scoring triggered by preference save: last 7 days, max 100 articles

### LLM Configuration
- Temperature 0 for deterministic output
- Structured output via Pydantic schema (format=CategoryResponse.model_json_schema())
- Tenacity retry: 3 attempts, exponential backoff (min 2s, max 10s)
- Article text truncation: 2000 chars (categorization), 3000 chars (scoring)
- Timeout from settings.ollama.timeout (default 120s)

### Integration Patterns
- Circular import avoidance: import scoring_queue at call site in feeds.py and main.py
- save_articles uses session.flush() to get IDs before commit
- Feed refresh auto-enqueues new articles immediately after saving
- Preference updates auto-trigger re-scoring without separate API call

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully without issues.

## Next Phase Readiness

- Scoring engine fully operational and processing articles in background
- New articles from feed refresh automatically enter scoring pipeline
- Preference changes trigger re-scoring of recent articles
- Queue status endpoint available for UI monitoring (Plan 04)
- Composite scores ready for article ranking in UI (Plan 04-05)
- Failed scoring attempts logged and marked without crashing queue

**Blockers:** None

**Note:** Pre-existing ruff warnings in main.py (E712, B904) are unrelated to this plan's changes. New code passes ruff checks.

## Self-Check: PASSED

All claimed files exist:
- ✓ backend/src/backend/prompts.py
- ✓ backend/src/backend/scoring.py
- ✓ backend/src/backend/scoring_queue.py
- ✓ backend/src/backend/scheduler.py
- ✓ backend/src/backend/feeds.py
- ✓ backend/src/backend/main.py
- ✓ backend/pyproject.toml
- ✓ backend/uv.lock

All claimed commits exist:
- ✓ 086e7ce (Task 1)
- ✓ 39d6eba (Task 2)

All imports verified:
- ✓ CategoryResponse, ScoringResponse, DEFAULT_CATEGORIES from prompts
- ✓ categorize_article, score_article, compute_composite_score from scoring
- ✓ ScoringQueue class imports cleanly
- ✓ scoring_queue exported from scheduler

All functions verified:
- ✓ compute_composite_score(8, 7, ['technology'], {'technology': 'high'}) returns 13.6
- ✓ 25 seed categories loaded

---
*Phase: 04-llm-content-curation*
*Completed: 2026-02-13*
