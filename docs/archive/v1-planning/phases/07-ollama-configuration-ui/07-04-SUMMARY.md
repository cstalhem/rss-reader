---
phase: 07-ollama-configuration-ui
plan: 04
subsystem: backend-api, frontend-ui
tags: [gap-closure, error-handling, user-experience]
dependency_graph:
  requires: [07-02, 07-03]
  provides: [error-feedback, unconditional-rescore]
  affects: [model-management, article-scoring]
tech_stack:
  added: []
  patterns: [defensive-error-checking, unconditional-fallback]
key_files:
  created: []
  modified:
    - backend/src/backend/ollama_service.py
    - frontend/src/hooks/useModelPull.ts
    - backend/src/backend/main.py
decisions:
  - context: Ollama Python client (v0.6.1) raises ResponseError on model-not-found instead of yielding error chunks
    choice: Added defensive error field checking in addition to exception handler
    rationale: Guards against future client behavior changes and other error scenarios
    alternatives: [rely-solely-on-exception-handler]
  - context: Re-evaluate button should work regardless of whether config changed
    choice: Default rescore_mode to 'full' when no model change detected
    rationale: Clarifies user intent - "re-score my articles" not "re-score only if models changed"
    alternatives: [disable-button-when-no-change]
metrics:
  duration_minutes: 5
  tasks_completed: 3
  files_modified: 3
  commits: 3
  completed_date: 2026-02-15
---

# Phase 07 Plan 04: Backend Error Handling and Unconditional Re-scoring

Fixed error surfacing for model downloads and unconditional article re-queueing for explicit re-evaluation requests.

## Objective

Address Gap 7 (model download errors not displayed) and Gap 8 (re-evaluate button not working) by fixing backend error handling and re-scoring logic.

## What Was Built

### 1. Backend Error Detection (ollama_service.py)
Added defensive error field checking in the Ollama pull stream handler:
- Checks for `"error"` field in SSE chunks before processing
- Yields error chunk and stops streaming when error detected
- Complements existing exception handler (Python ollama client v0.6.1 raises exceptions, but this guards against future changes)

### 2. Frontend Error Parsing (useModelPull.ts)
Enhanced SSE chunk parser to handle error responses:
- Detects `data.error` field in SSE chunks
- Sets error state and clears downloading state when error occurs
- Returns early to stop processing further chunks
- Surfaces Ollama error messages in existing UI error display

### 3. Unconditional Re-queueing (main.py)
Modified PUT /api/ollama/config endpoint to always re-queue when rescore=true:
- After determining rescore_mode from model config diff, added fallback
- If rescore_mode is None (no model change), default to "full"
- Ensures re-evaluate button always triggers re-scoring regardless of config changes
- Clarifies user intent: "re-score my articles" not "re-score only if changed"

## Key Implementation Details

**Error Surfacing Flow:**
1. User attempts to pull non-existent model (e.g., "fake-model:latest")
2. Ollama API returns `{"error": "pull model manifest: file does not exist"}`
3. Python ollama client (v0.6.1) raises ResponseError exception
4. Backend exception handler (main.py line 741) catches and yields `{"status": "error", "error": "..."}`
5. Frontend useModelPull hook detects error field and sets error state
6. UI displays error message below model input (existing error UI in ModelManagement.tsx)

**Re-evaluate Flow:**
1. User saves model config change → button becomes enabled
2. User clicks "Re-evaluate unread articles" (no further config changes)
3. Frontend sends PUT request with current config + rescore=true
4. Backend compares config, finds no change → rescore_mode would be None
5. NEW: Fallback sets rescore_mode = "full" when None and rescore=true
6. Backend queries unread scored articles and re-queues them
7. Backend returns rescore_queued count > 0
8. Frontend shows toast: "X articles queued for re-evaluation"

## Testing Performed

### Error Handling (Tasks 1-2)
```bash
# Test non-existent model pull
curl -X POST http://127.0.0.1:8912/api/ollama/models/pull \
  -H 'Content-Type: application/json' \
  -d '{"model": "fake-model:latest"}' -N

# Response included error in SSE stream:
data: {"status": "pulling manifest", ...}
data: {"status": "error", "error": "pull model manifest: file does not exist (status code: -1)"}
```

### Unconditional Re-queueing (Task 3)
```bash
# Get current config
curl http://127.0.0.1:8912/api/ollama/config
# {"categorization_model":"qwen3-vl:4b-instruct",...}

# Send re-evaluate with same config
curl -X PUT http://127.0.0.1:8912/api/ollama/config \
  -H 'Content-Type: application/json' \
  -d '{"categorization_model":"qwen3-vl:4b-instruct",...,"rescore":true}'

# Response: {"rescore_queued":30}  ← Previously would have been 0

# Backend logs confirmed:
# "Enqueued 30 articles for re-scoring (mode=full)"
```

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- [x] Non-existent model pulls display error messages from Ollama instead of fake progress
- [x] Re-evaluate button always triggers re-scoring and shows toast, regardless of whether config changed
- [x] Both backend and frontend handle Ollama error responses correctly
- [x] Existing progress bar and cancel functionality remain unaffected

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| c654259 | feat(07-04): add error detection to Ollama pull stream | ollama_service.py |
| 37e91b8 | feat(07-04): parse error chunks in useModelPull hook | useModelPull.ts |
| 2a4c74f | feat(07-04): implement unconditional re-queue when rescore=true | main.py |

## Technical Notes

**Ollama Client Behavior:** The Python ollama client (v0.6.1) raises ResponseError exceptions for model-not-found errors rather than yielding error chunks like the raw API does. The defensive error field checking in ollama_service.py guards against future client behavior changes or other error scenarios that might yield error chunks without raising exceptions.

**Rescore Mode Logic:** The unconditional fallback to "full" mode when no model change is detected ensures user intent is respected. When a user explicitly clicks "Re-evaluate", they mean "re-score these articles" not "re-score only if something changed". The button state management in the frontend already ensures it's only enabled when appropriate.

## Self-Check: PASSED

**Files exist:**
```bash
FOUND: backend/src/backend/ollama_service.py
FOUND: frontend/src/hooks/useModelPull.ts
FOUND: backend/src/backend/main.py
```

**Commits exist:**
```bash
FOUND: c654259
FOUND: 37e91b8
FOUND: 2a4c74f
```

**Functionality verified:**
- Error detection code present in ollama_service.py (lines 108-111)
- Error parsing code present in useModelPull.ts (lines 132-139)
- Unconditional fallback present in main.py (lines 857-860)
- Backend test confirmed rescore_queued > 0 when no config changed
