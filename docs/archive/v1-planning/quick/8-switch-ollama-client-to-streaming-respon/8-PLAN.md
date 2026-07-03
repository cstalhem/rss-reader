---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/backend/scoring.py
  - backend/src/backend/scoring_queue.py
autonomous: true

must_haves:
  truths:
    - "LLM inference does not timeout on slower models"
    - "Batch size of 1 prevents long job lock on APScheduler"
  artifacts:
    - path: "backend/src/backend/scoring.py"
      provides: "Streaming Ollama client calls"
      contains: "stream=True"
    - path: "backend/src/backend/scoring_queue.py"
      provides: "Batch size default of 1"
      pattern: "batch_size: int = 1"
  key_links:
    - from: "categorize_article()"
      to: "AsyncClient.chat()"
      via: "stream=True parameter"
      pattern: "stream=True"
    - from: "score_article()"
      to: "AsyncClient.chat()"
      via: "stream=True parameter"
      pattern: "stream=True"
---

<objective>
Switch Ollama client to streaming responses to prevent httpx.ReadTimeout on slower models and reduce batch size to 1 for faster job completion.

Purpose: Allow slower Ollama models (e.g., qwen2.5:7b) to complete inference without timing out the 120s httpx read timeout. Streaming chunks arrive continuously, resetting the timeout.

Output: Modified scoring pipeline that streams LLM responses and processes one article at a time.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md

@backend/src/backend/scoring.py
@backend/src/backend/scoring_queue.py

## Problem

The Ollama scoring pipeline uses `stream=False` (default), meaning httpx waits for the entire LLM response with a 120s read timeout. With slower models, inference can exceed this timeout, causing:
- `httpx.ReadTimeout` exception
- `tenacity.RetryError` after 3 attempts
- Articles marked as `failed` in scoring_state

Additionally, `process_next_batch` fetches 5 articles but processes them sequentially in a for loop — this isn't true batching and holds the APScheduler job lock for 5× longer than necessary.

## Solution

1. Switch both `categorize_article()` and `score_article()` to use `stream=True` and accumulate chunks
2. Change default `batch_size` from 5 to 1 in `process_next_batch()`

The `format` parameter for structured JSON output works alongside `stream=True` (validated via Context7 Ollama Python docs).

## Streaming Pattern (from Ollama Python docs)

```python
async for chunk in await client.chat(model=..., messages=[...], stream=True):
    content += chunk['message']['content']
```
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch categorize_article and score_article to streaming</name>
  <files>backend/src/backend/scoring.py</files>
  <action>
Modify both `categorize_article()` (line 61) and `score_article()` (line 117) to use streaming:

1. Change `response = await client.chat(...)` to use `stream=True`
2. Accumulate chunks: `content = ""`
3. Add async loop: `async for chunk in await client.chat(..., stream=True):`
4. Accumulate: `content += chunk['message']['content']`
5. Parse accumulated content: `CategoryResponse.model_validate_json(content)` or `ScoringResponse.model_validate_json(content)`

The `format=...` parameter stays the same — structured JSON output works with streaming.

Pattern:
```python
content = ""
async for chunk in await client.chat(
    model=settings.ollama.categorization_model,
    messages=[{"role": "user", "content": prompt}],
    format=CategoryResponse.model_json_schema(),
    options={"temperature": 0},
    stream=True,
):
    content += chunk['message']['content']

result = CategoryResponse.model_validate_json(content)
```

Apply to both functions.
  </action>
  <verify>
1. Run backend tests: `cd backend && uv run pytest -v`
2. Check that both functions now have `stream=True` parameter
3. Verify `content` accumulation pattern exists in both functions
  </verify>
  <done>
Both `categorize_article()` and `score_article()` use `stream=True` and accumulate chunks. Tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Reduce batch size default from 5 to 1</name>
  <files>backend/src/backend/scoring_queue.py</files>
  <action>
Change `process_next_batch()` signature on line 89:

From: `async def process_next_batch(self, session: Session, batch_size: int = 5) -> int:`
To: `async def process_next_batch(self, session: Session, batch_size: int = 1) -> int:`

This reduces the default APScheduler job lock time from 5× article processing to 1× article processing. The sequential for loop (line 131) is unchanged — it still processes the batch sequentially, but the batch is now size 1 by default.
  </action>
  <verify>
1. Check line 89 in `scoring_queue.py` shows `batch_size: int = 1`
2. Run tests: `cd backend && uv run pytest -v`
  </verify>
  <done>
`batch_size` default is 1. Tests pass.
  </done>
</task>

</tasks>

<verification>
1. Backend tests pass: `cd backend && uv run pytest`
2. Both functions in `scoring.py` use `stream=True`
3. `batch_size` default is 1 in `scoring_queue.py`
4. No breaking changes to function signatures (internal implementation only)
</verification>

<success_criteria>
- `categorize_article()` and `score_article()` accumulate streaming chunks
- `batch_size` default is 1 in `process_next_batch()`
- Backend tests pass
- No httpx.ReadTimeout on slower Ollama models
</success_criteria>

<output>
After completion, create `.planning/quick/8-switch-ollama-client-to-streaming-respon/8-SUMMARY.md`
</output>
