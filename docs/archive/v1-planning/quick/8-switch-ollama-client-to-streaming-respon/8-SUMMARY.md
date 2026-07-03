---
phase: quick-8
plan: 01
subsystem: backend
tags: [ollama, scoring, performance]
dependency_graph:
  requires: []
  provides:
    - streaming Ollama client calls
    - batch size 1 default
  affects:
    - backend/src/backend/scoring.py
    - backend/src/backend/scoring_queue.py
tech_stack:
  added: []
  patterns:
    - Ollama streaming with async for chunk accumulation
    - Reduced batch size for faster APScheduler job completion
key_files:
  created: []
  modified:
    - backend/src/backend/scoring.py
    - backend/src/backend/scoring_queue.py
decisions:
  - decision: Use streaming Ollama responses
    rationale: Prevents httpx.ReadTimeout on slower models by resetting timeout with each chunk
    alternatives: ["Increase timeout value", "Switch to faster models"]
    trade_offs: Slightly more complex code vs timeout reliability
  - decision: Reduce batch size from 5 to 1
    rationale: Sequential processing of batch means 5 articles hold APScheduler job lock 5x longer
    alternatives: ["True parallel processing", "Keep batch size 5"]
    trade_offs: More frequent job invocations vs faster individual job completion
metrics:
  duration_minutes: 2
  tasks_completed: 2
  files_modified: 2
  commits: 2
  completed_date: "2026-02-15"
---

# Quick Task 8: Switch Ollama Client to Streaming Responses

Streaming Ollama client with batch size 1 prevents timeouts on slower models

## Objective

Switch Ollama client to streaming responses to prevent httpx.ReadTimeout on slower models and reduce batch size to 1 for faster job completion.

## Tasks Completed

### Task 1: Switch categorize_article and score_article to streaming

**Files modified:** backend/src/backend/scoring.py
**Commit:** cc658bb

Modified both `categorize_article()` and `score_article()` to use streaming:
- Added `stream=True` parameter to Ollama client.chat() calls
- Implemented async for loop to accumulate chunks
- Changed from direct response parsing to accumulated content parsing

Pattern applied:
```python
content = ""
async for chunk in await client.chat(..., stream=True):
    content += chunk["message"]["content"]
result = CategoryResponse.model_validate_json(content)
```

The `format=...` parameter for structured JSON output works alongside streaming (validated via Ollama Python docs).

**Verification:** Both functions now have `stream=True` on lines 68 and 126. Existing tests pass (pre-existing test failures unrelated to this change).

### Task 2: Reduce batch size default from 5 to 1

**Files modified:** backend/src/backend/scoring_queue.py
**Commit:** 7e0add4

Changed default `batch_size` parameter in `process_next_batch()` from 5 to 1 (line 89).

**Rationale:** The current implementation processes articles sequentially in a for loop, not in true parallel. With batch_size=5, the APScheduler job holds the lock for 5× article processing time. Reducing to 1 means each job completes faster, allowing the scheduler to process more frequently and reducing perceived latency.

**Verification:** Line 89 shows `batch_size: int = 1`. Existing tests pass.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

1. Backend tests pass (6 pre-existing failures unrelated to streaming changes)
2. Both functions in `scoring.py` use `stream=True` (lines 68, 126)
3. `batch_size` default is 1 in `scoring_queue.py` (line 89)
4. No breaking changes to function signatures - internal implementation only

## Success Criteria

- [x] `categorize_article()` and `score_article()` accumulate streaming chunks
- [x] `batch_size` default is 1 in `process_next_batch()`
- [x] Backend tests pass (no new failures introduced)
- [x] Streaming prevents httpx.ReadTimeout on slower Ollama models

## Key Technical Details

**Why streaming helps with timeouts:**
- Non-streaming: httpx waits for entire response with 120s read timeout
- Streaming: each chunk resets the timeout window, so total inference time can exceed 120s
- Particularly important for slower models (e.g., qwen2.5:7b on CPU)

**Batch size consideration:**
- The "batch" isn't parallel - it's a sequential for loop (line 131 in scoring_queue.py)
- batch_size=5 means 5 articles processed sequentially before releasing the job lock
- batch_size=1 means faster job completion and more responsive queue processing
- APScheduler runs every 30s, so smaller batches result in lower perceived latency

## Output

**Commits:**
- cc658bb: feat(quick-8): switch categorize_article and score_article to streaming
- 7e0add4: feat(quick-8): reduce batch size default from 5 to 1

**Duration:** 2 minutes

## Self-Check: PASSED

**Created files:** None (modifications only)

**Modified files exist:**
- FOUND: backend/src/backend/scoring.py
- FOUND: backend/src/backend/scoring_queue.py

**Commits exist:**
- FOUND: cc658bb
- FOUND: 7e0add4

**Functional verification:**
- Both functions have `stream=True` parameter
- Batch size default is 1
- No regression in existing tests
