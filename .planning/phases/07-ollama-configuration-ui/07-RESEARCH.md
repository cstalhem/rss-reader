# Phase 7: Ollama Configuration UI - Research

**Researched:** 2026-02-15
**Domain:** Ollama API integration, two-tier config pattern, SSE streaming, settings UI
**Confidence:** HIGH

## Summary

This phase adds runtime Ollama configuration to the settings UI. The core challenge is threefold: (1) implementing a two-tier config pattern where YAML/env settings provide infrastructure defaults but runtime model choices persist in the database, (2) proxying Ollama's streaming model pull API through FastAPI to the frontend with progress tracking, and (3) building a re-scoring workflow that intelligently determines pipeline scope based on what changed.

The existing codebase already has all the building blocks: the `ollama` Python library (v0.6.1) with `AsyncClient` methods for `list()`, `pull(stream=True)`, `delete()`, and `ps()` covers every Ollama operation needed. FastAPI's `StreamingResponse` handles SSE for pull progress. The frontend settings page has a placeholder component (`OllamaPlaceholder.tsx`) ready to be replaced, and the `useScoringStatus` hook plus scoring tab already exist for re-scoring feedback.

**Primary recommendation:** Build backend API endpoints that wrap `ollama.AsyncClient` methods, store model preferences in `UserPreferences`, and use `StreamingResponse` (SSE) for pull progress. Frontend consumes these via TanStack Query (polling for status) and native `EventSource` (for pull progress streaming).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Model Management UX:**
- Model dropdowns show name + size (e.g., "llama3.2:3b -- 2.0 GB")
- Default to a single model selector for both categorization and scoring
- Show a "Use separate models" toggle only when 2+ models are available locally
- When split, show a RAM warning that both models need to fit in available memory
- Show which model(s) are currently loaded in Ollama's memory with a small badge/indicator
- Model changes require an explicit Save button (not auto-save on change)
- When changing model during active scoring: switch after current batch completes, with an informational message explaining the behavior
- When Ollama is disconnected: disable dropdowns with a message ("Connect to Ollama to manage models")

**Config Storage:**
- Store runtime Ollama preferences (selected models, split toggle) in the database (UserPreferences table), not Pydantic Settings
- YAML config becomes the initial default only -- runtime changes apply without restart
- This is the two-tier config pattern noted in STATE.md

**Download Experience:**
- Curated suggestions: hardcoded list of 4-6 recommended models for classification/scoring, plus a text input for custom model names
- Already-downloaded models marked with an "Installed" badge in the suggestions list (not hidden)
- Inline progress bar replacing the Pull button during download, showing percentage and speed
- Cancel button available during downloads (Ollama supports aborting pulls)
- Delete models from within settings UI with a confirmation dialog
- Model management (download/delete) lives in the same section as model selection
- Backend tracks download state -- user can navigate away and return to see current progress
- Subtle indicator on the Ollama settings tab when a download is in progress (visible from other settings sections)

**Re-scoring Workflow:**
- Scope: re-evaluate all unread articles
- Explicit "Re-evaluate unread articles" button (generic label) -- inactive until relevant settings have changed
- Smart pipeline: if categorization model changed, re-run full pipeline (categorize + score); if only scoring model changed, re-run scoring only
- During re-scoring: preserve old data but move articles to the Scoring tab (away from Unread)
- Uses the existing scoring status indicator from Phase 5 for progress feedback -- no new progress UI
- Re-scored articles get priority in the scoring queue (ahead of newly fetched articles)
- No cancel once re-scoring starts -- let it finish to avoid mixed-state articles

**Health & Status Presentation:**
- Connection badge only in Ollama settings section (not in app header/sidebar)
- Badge shows: status (connected/disconnected) + latency + Ollama server version
- Auto-refresh every 15-30 seconds while the Ollama settings section is visible; stops when navigating away

**System Prompts Display:**
- Read-only text areas showing current categorization and scoring prompts (per success criteria)

### Claude's Discretion
- Exact curated model list (which 4-6 models to recommend)
- Progress bar styling and animation
- Health badge visual design (colors, icon choice)
- Auto-refresh interval (15s vs 30s)
- System prompt text area formatting (syntax highlighting, collapsible, etc.)
- How the "settings changed" detection works for the re-score button activation
- Download speed display format

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| ollama (Python) | 0.6.1 | AsyncClient for list/pull/delete/ps | Already used for scoring |
| httpx | 0.28.1 | HTTP client for health/version check | Already a dependency |
| FastAPI | 0.128+ | StreamingResponse for SSE pull progress | Already the backend framework |
| @tanstack/react-query | 5.90+ | Polling for health/models, mutations for save/delete | Already the data layer |

### Supporting (No New Dependencies Needed)
| Tool | Purpose | Notes |
|------|---------|-------|
| FastAPI StreamingResponse | SSE for model pull progress | Built-in, no extra package needed |
| Native EventSource API | Frontend SSE consumption | Browser built-in, no library needed |
| SQLModel / UserPreferences | Persist runtime model config | Existing table, add columns |

**No new packages are required.** The existing stack covers all needs.

## Architecture Patterns

### Two-Tier Config Pattern

This is the critical architectural change. Currently, `scoring.py` reads model names from `settings.ollama.categorization_model` and `settings.ollama.scoring_model` (Pydantic Settings, `@lru_cache`-cached, immutable at runtime). The new pattern:

**Tier 1 (Infrastructure):** Pydantic Settings (`config.py`) -- Ollama host URL, timeouts, logging. Immutable at runtime. Set via YAML/env vars.

**Tier 2 (Runtime):** UserPreferences table -- selected models, split toggle. Mutable via UI. Initialized from Tier 1 defaults on first access.

**Implementation pattern:**
```python
# In scoring_queue.py / scoring.py, BEFORE scoring an article:
# 1. Read ollama host from Tier 1 (settings.ollama.host) -- never changes
# 2. Read model names from Tier 2 (UserPreferences) -- can change between batches
# 3. Pass both to categorize_article() / score_article()

# The scoring functions already accept `settings` as a param.
# Create a lightweight object or namedtuple that combines both tiers:
class OllamaRuntime:
    host: str           # From Pydantic Settings (Tier 1)
    categorization_model: str  # From UserPreferences (Tier 2)
    scoring_model: str         # From UserPreferences (Tier 2)
    thinking: bool             # From Pydantic Settings (Tier 1)
```

**Key detail:** The `scoring_queue.py` already reads `settings` at the module level (`settings = get_settings()`). The runtime model must be read per-batch instead, from the database. The host and thinking settings can stay on Pydantic Settings.

### UserPreferences Table Extension

Add columns to `UserPreferences`:
```python
# New fields for Ollama runtime config
ollama_categorization_model: str | None = Field(default=None)
ollama_scoring_model: str | None = Field(default=None)
ollama_use_separate_models: bool = Field(default=False)
```

When `ollama_categorization_model` is `None`, fall back to `settings.ollama.categorization_model` (YAML default). This preserves backward compatibility -- existing installations keep working without DB changes.

### Backend API Endpoints

New endpoints needed:

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/ollama/health` | GET | Connection status + version + latency | `{connected, version, latency_ms}` |
| `/api/ollama/models` | GET | List locally available models | `{models: [{name, size, parameter_size, quantization, is_loaded}]}` |
| `/api/ollama/models/pull` | POST | Start model download (SSE stream) | SSE: `{status, completed, total, digest}` |
| `/api/ollama/models/pull/cancel` | POST | Cancel active download | `{status}` |
| `/api/ollama/models/{name}` | DELETE | Delete a model | `{status}` |
| `/api/ollama/download-status` | GET | Current download state (polling) | `{active, model, completed, total}` |
| `/api/ollama/prompts` | GET | Current system prompts | `{categorization_prompt, scoring_prompt}` |
| `/api/ollama/config` | GET | Current runtime Ollama config | `{categorization_model, scoring_model, use_separate_models}` |
| `/api/ollama/config` | PUT | Save model config + trigger re-score | `{...config, rescore_queued}` |

### SSE Streaming for Pull Progress

```python
from fastapi.responses import StreamingResponse
import json

@app.post("/api/ollama/models/pull")
async def pull_model(request: PullModelRequest):
    client = AsyncClient(host=settings.ollama.host)

    async def event_stream():
        async for progress in await client.pull(request.model, stream=True):
            data = {
                "status": progress.status,
                "completed": progress.completed,
                "total": progress.total,
                "digest": progress.digest,
            }
            yield f"data: {json.dumps(data)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )
```

**Cancel mechanism:** Store the `asyncio.Task` wrapping the pull in a module-level dict. On cancel request, call `task.cancel()`. The `AsyncClient` streaming iterator will raise `asyncio.CancelledError`.

```python
# Module-level state for tracking active downloads
_active_download: dict = {"task": None, "model": None, "completed": 0, "total": 0}
```

### Backend Download State Tracking

The user should be able to navigate away and return to see progress. Pattern:

```python
# Module-level (safe in single-worker asyncio, same as _scoring_activity)
_download_state = {
    "active": False,
    "model": None,
    "completed": 0,
    "total": 0,
    "status": None,
}
```

The SSE endpoint updates this state as chunks arrive. A separate polling endpoint (`GET /api/ollama/download-status`) returns the current snapshot for when the user navigates back to the settings page.

### Frontend Architecture

```
frontend/src/
  components/settings/
    OllamaSection.tsx          # Main section (replaces OllamaPlaceholder)
    OllamaHealthBadge.tsx      # Connection status badge
    ModelSelector.tsx           # Model dropdown(s) with save button
    ModelManagement.tsx         # Download/delete models
    ModelPullProgress.tsx       # Progress bar for active download
    SystemPrompts.tsx           # Read-only prompt display
    RescoreButton.tsx           # Re-evaluate button
  hooks/
    useOllamaHealth.ts         # Polls /api/ollama/health
    useOllamaModels.ts         # Fetches /api/ollama/models
    useOllamaConfig.ts         # Fetches/saves /api/ollama/config
    useModelPull.ts            # EventSource + download-status polling
```

### Frontend SSE Consumption Pattern

TanStack Query does not natively support SSE. Use native `EventSource` for the pull stream, and `queryClient.setQueryData` to update cached state:

```typescript
// useModelPull.ts
function useModelPull() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<PullProgress | null>(null);

  const startPull = (model: string) => {
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/ollama/models/pull?model=${encodeURIComponent(model)}`
    );
    // Note: EventSource only supports GET. For POST, use fetch with ReadableStream.
    // Alternative: use fetch() with response.body.getReader() for POST SSE.
  };
}
```

**Important caveat:** `EventSource` only supports GET requests. Since pull is a POST (it modifies server state), use the Fetch API with `ReadableStream` instead:

```typescript
const response = await fetch(`${API_BASE_URL}/api/ollama/models/pull`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ model }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // Parse SSE lines: "data: {...}\n\n"
  // Update progress state
}
```

### Health Check Pattern

The Ollama Python client has no `version()` method. Use `httpx` directly:

```python
import httpx
import time

async def check_ollama_health(host: str) -> dict:
    try:
        start = time.monotonic()
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{host}/api/version", timeout=5.0)
        latency_ms = round((time.monotonic() - start) * 1000)
        data = response.json()
        return {
            "connected": True,
            "version": data.get("version"),
            "latency_ms": latency_ms,
        }
    except Exception:
        return {
            "connected": False,
            "version": None,
            "latency_ms": None,
        }
```

### Re-scoring Workflow

**"Settings changed" detection:** Track what the saved config was when the page loaded. Compare current form state to saved state. Enable the re-score button only when they differ. After save + re-score, the button becomes inactive again.

**Smart pipeline logic (backend):**

```python
# In the PUT /api/ollama/config endpoint:
old_config = get_current_runtime_config(session)  # From UserPreferences
new_config = request_body

rescore_mode = None
if new_config.categorization_model != old_config.categorization_model:
    rescore_mode = "full"  # Re-categorize + re-score
elif new_config.scoring_model != old_config.scoring_model:
    rescore_mode = "score_only"  # Skip categorization, re-score only

# Save new config to UserPreferences
# If rescore requested, enqueue unread articles with priority flag
```

**Priority queue for re-scored articles:** Add a `priority` flag or use a separate query ordering. When fetching the next batch from the queue, `ORDER BY priority DESC, published_at ASC` ensures re-scored articles are processed first.

**Score-only re-scoring:** When only the scoring model changed, skip `categorize_article()` and go directly to `score_article()`. The existing categories remain valid. Need a way to signal this to `process_next_batch` -- either a column on the article (`rescore_mode`) or a separate flag.

### Model List Enrichment

Combine `client.list()` (all local models) with `client.ps()` (loaded models) to show which are currently in memory:

```python
async def get_enriched_models(host: str):
    client = AsyncClient(host=host)
    all_models = await client.list()
    running = await client.ps()

    loaded_names = {m.model for m in running.models}

    return [
        {
            "name": m.model,
            "size": m.size,
            "parameter_size": m.details.parameter_size if m.details else None,
            "quantization_level": m.details.quantization_level if m.details else None,
            "is_loaded": m.model in loaded_names,
        }
        for m in all_models.models
    ]
```

### Recommended Project Structure (Backend Changes)

```
backend/src/backend/
  ollama_service.py    # New: Ollama API wrapper (health, models, pull, delete)
  main.py              # Add new /api/ollama/* endpoints
  models.py            # Extend UserPreferences with ollama config fields
  scoring_queue.py     # Read model config from DB instead of settings
  scoring.py           # Accept runtime config instead of settings object
  database.py          # Migration for new UserPreferences columns
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ollama model operations | Custom HTTP calls to Ollama REST API | `ollama.AsyncClient` (list, pull, delete, ps) | Already installed, handles auth/encoding/types |
| SSE formatting | Custom event formatting | FastAPI `StreamingResponse` with `text/event-stream` | Standard SSE format, handles connection cleanup |
| Progress byte tracking | Custom download manager | Ollama pull stream `completed`/`total` fields | Ollama provides progress natively |
| Health check latency | Custom timing wrapper | `time.monotonic()` around `httpx.get` | Simple, precise |
| Form dirty detection | Deep comparison library | Shallow compare of `{categorization_model, scoring_model, use_separate_models}` | Only 3 fields, trivial comparison |

## Common Pitfalls

### Pitfall 1: Pydantic Settings Cache Prevents Runtime Updates
**What goes wrong:** `get_settings()` is cached with `@lru_cache`. Updating YAML or env vars at runtime has zero effect.
**Why it happens:** The cache is intentional for performance but creates an immutable config.
**How to avoid:** Never store runtime-mutable config in Pydantic Settings. Use UserPreferences DB table for anything the UI can change. Ollama host stays in Settings (infrastructure); model names go in UserPreferences (runtime).
**Warning signs:** Config changes don't take effect until restart.

### Pitfall 2: SQLAlchemy JSON Column Mutation
**What goes wrong:** In-place mutations to JSON columns (dicts) are silently lost.
**Why it happens:** SQLAlchemy doesn't detect mutations inside JSON fields.
**How to avoid:** Always reassign the entire value: `prefs.topic_weights = {**prefs.topic_weights, key: val}`. Already documented in AGENTS.md but critical to remember for any new JSON columns.
**Warning signs:** Data reverts to previous state after commit.

### Pitfall 3: EventSource Only Supports GET
**What goes wrong:** Attempting `new EventSource(url)` for a POST endpoint fails.
**Why it happens:** The EventSource browser API only makes GET requests.
**How to avoid:** For the model pull (POST), use `fetch()` with `response.body.getReader()` to read the SSE stream. Or change the endpoint to GET with query params (but POST is more correct semantically).
**Warning signs:** 405 Method Not Allowed or pull not starting.

### Pitfall 4: Race Condition on Model Switch During Scoring
**What goes wrong:** User saves new model while scoring is in progress. Current batch uses old model, next batch uses new model, creating inconsistent scoring.
**Why it happens:** `process_next_batch` reads config once per batch.
**How to avoid:** Per the user's decision, switch after current batch completes. The scoring queue reads runtime config at the start of each batch (from DB), so this happens naturally as long as config is read per-batch, not per-module-load. Show an informational message to the user.
**Warning signs:** Module-level `settings = get_settings()` in `scoring_queue.py` reads config once at import time.

### Pitfall 5: Stale Module-Level Settings References
**What goes wrong:** `scoring_queue.py` has `settings = get_settings()` at module level. Even after implementing two-tier config, the scoring functions might still read from this stale reference.
**Why it happens:** Module-level code runs once at import.
**How to avoid:** Change scoring functions to read runtime config (model names) from the database within each batch. Keep the module-level `settings` only for infrastructure values (host, logging, scheduler intervals).
**Warning signs:** Model changes in UI don't affect scoring behavior.

### Pitfall 6: Download State Lost on Server Restart
**What goes wrong:** User starts a download, server restarts, download state shows nothing.
**Why it happens:** Download state is in-memory (`_download_state` dict).
**How to avoid:** This is acceptable for this use case. Downloads are short-lived (minutes), and Ollama itself resumes partial downloads. On reconnect, the health check will show the model as available if it completed. No need for persistent download tracking.
**Warning signs:** None -- this is a conscious tradeoff.

### Pitfall 7: Large Model Names in Ollama
**What goes wrong:** Ollama model names include tags (e.g., `llama3.2:3b-instruct-q4_K_M`). Comparing model names requires exact string matching.
**Why it happens:** Ollama uses `name:tag` format. `qwen3:8b` and `qwen3:latest` might be the same model but different strings.
**How to avoid:** Store the exact model name string as returned by `client.list()`. Use dropdown values from the same source. Don't try to normalize or parse model names.
**Warning signs:** Model appears "changed" when it hasn't, or re-score triggers unnecessarily.

## Code Examples

### Ollama AsyncClient API Usage (verified from installed v0.6.1)

```python
from ollama import AsyncClient

client = AsyncClient(host="http://localhost:11434")

# List local models
result = await client.list()
# result.models: list of Model objects
# Each model: {model, modified_at, size, digest, details: {format, family, parameter_size, quantization_level}}

# List running/loaded models
result = await client.ps()
# result.models: list of Model objects with additional fields
# Each model: {model, name, size, size_vram, expires_at, context_length, details: {...}}

# Pull model with streaming progress
async for progress in await client.pull("llama3.2:3b", stream=True):
    # progress: {status, completed, total, digest}
    # status: "pulling manifest", "pulling <digest>", "verifying digest", "writing manifest", "success"
    # completed/total: byte counts for current layer being downloaded
    pass

# Delete model
result = await client.delete("llama3.2:3b")
# result: {status: "success" | "error"}
```

### FastAPI SSE Streaming Response

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

@app.post("/api/ollama/models/pull")
async def pull_model(request: PullModelRequest):
    client = AsyncClient(host=settings.ollama.host)

    async def event_stream():
        try:
            async for progress in await client.pull(request.model, stream=True):
                # Update module-level download state for polling endpoint
                _download_state.update({
                    "active": True,
                    "model": request.model,
                    "completed": progress.completed,
                    "total": progress.total,
                    "status": progress.status,
                })
                yield f"data: {json.dumps({
                    'status': progress.status,
                    'completed': progress.completed,
                    'total': progress.total,
                })}\n\n"
        finally:
            _download_state.update({"active": False, "model": None})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

### Frontend Fetch-Based SSE Reading

```typescript
async function pullModel(
  model: string,
  onProgress: (data: PullProgress) => void,
  signal?: AbortSignal
) {
  const response = await fetch(`${API_BASE_URL}/api/ollama/models/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
    signal,
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        onProgress(data);
      }
    }
  }
}
```

### UserPreferences Column Migration

```python
# In database.py, add migration function:
def _migrate_user_preferences_ollama_columns():
    inspector = inspect(engine)
    existing = {col["name"] for col in inspector.get_columns("user_preferences")}

    new_columns = [
        ("ollama_categorization_model", "TEXT"),
        ("ollama_scoring_model", "TEXT"),
        ("ollama_use_separate_models", "BOOLEAN DEFAULT 0"),
    ]

    with engine.begin() as conn:
        for col_name, col_type in new_columns:
            if col_name not in existing:
                logger.info(f"Adding column user_preferences.{col_name}")
                conn.execute(
                    text(f"ALTER TABLE user_preferences ADD COLUMN {col_name} {col_type}")
                )
```

## Discretionary Recommendations

### Curated Model List (Claude's Discretion)

Recommended 5 models covering the range of capability and resource usage for classification/scoring tasks:

| Model | Size | Why |
|-------|------|-----|
| `qwen3:1.7b` | ~1.0 GB | Smallest viable option, fast on CPU |
| `qwen3:4b` | ~2.5 GB | Good balance for most hardware |
| `qwen3:8b` | ~4.9 GB | Strong accuracy, needs 8GB+ RAM |
| `gemma3:4b` | ~3.3 GB | Google model, good at classification |
| `llama3.2:3b` | ~2.0 GB | Meta's efficient small model |

These are all proven for structured output (JSON schema) which is required by the scoring pipeline. The user already runs `qwen3-vl:2b-thinking` in production, so Qwen3 models should be prominently featured.

### Auto-Refresh Interval: 20 seconds

Recommendation: 20 seconds. Rationale: frequent enough to catch disconnections promptly, infrequent enough to not generate noticeable network noise. The query should use `refetchInterval` with conditional logic to stop polling when the settings section is not visible.

### System Prompt Display

Recommendation: Collapsible sections (collapsed by default) with monospace font and a subtle background. No syntax highlighting needed -- the prompts are plain text templates. Use Chakra's `Collapsible` component (if available in v3) or a simple disclosure pattern.

### Settings Changed Detection

Track the "saved state" when config is loaded from the API. Compare form values against saved state. The re-score button is enabled when `JSON.stringify(formState) !== JSON.stringify(savedState)`. After a successful save, update `savedState` to match `formState`, disabling the button again.

### Download Speed Display Format

Show speed in human-readable format: `"2.3 MB/s"`. Calculate by tracking bytes received over time windows. Display percentage as primary (`45%`), speed as secondary, and estimated time remaining if feasible.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `settings` object for all config | Two-tier: Settings (infra) + DB (runtime) | This phase | Model choices persist in DB, survive restarts, changeable via UI |
| Module-level `settings = get_settings()` | Per-batch config read from DB | This phase | Scoring uses latest model config without restart |
| Placeholder Ollama section | Full configuration UI | This phase | Users can manage models without editing YAML |

## Open Questions

1. **Priority queue implementation for re-scoring**
   - What we know: Re-scored articles should be processed before newly fetched ones
   - What's unclear: Best mechanism -- add a `priority` column to articles, or use a separate ordering field?
   - Recommendation: Add a `scoring_priority` integer column (default 0, set to 1 for re-score). Order by `scoring_priority DESC, published_at ASC` in the queue query. Simple, no schema redesign needed.

2. **Score-only re-scoring signal**
   - What we know: When only the scoring model changed, skip categorization
   - What's unclear: How to tell `process_next_batch` to skip categorization for specific articles
   - Recommendation: Add a `rescore_mode` column to articles (`"full"` or `"score_only"`). The queue processor checks this before calling `categorize_article()`. Set to `NULL` for normal scoring.

3. **Ollama pull cancellation reliability**
   - What we know: Ollama Python client does not have explicit cancel. `asyncio.Task.cancel()` raises `CancelledError`.
   - What's unclear: Whether canceling the Python task actually aborts the download on the Ollama server side, or if Ollama continues downloading in the background
   - Recommendation: Use `asyncio.Task.cancel()` for the streaming iterator. The connection close should signal Ollama to stop. If Ollama continues, the partial download will be resumed on next pull (Ollama's built-in behavior). Acceptable tradeoff.

4. **Frontend cancel via AbortController**
   - What we know: `fetch()` accepts an `AbortSignal`. Aborting closes the connection.
   - What's unclear: Whether closing the SSE connection from the client side also cancels the backend asyncio task
   - Recommendation: Both client-side `AbortController` and a dedicated backend cancel endpoint. The client abort closes the connection (which FastAPI detects as a client disconnect, causing the generator to terminate). The explicit cancel endpoint is a safety net for edge cases.

## Sources

### Primary (HIGH confidence)
- Ollama Python library v0.6.1 -- verified via `uv run python` introspection of `AsyncClient` methods, `ListResponse`, `ProcessResponse`, `ProgressResponse`, `StatusResponse` schemas
- Ollama REST API docs (docs.ollama.com/api) -- `/api/tags`, `/api/pull`, `/api/delete`, `/api/ps`, `/api/version` endpoints verified
- Codebase analysis -- `scoring.py`, `scoring_queue.py`, `config.py`, `models.py`, `main.py`, `database.py`, settings UI components all read directly

### Secondary (MEDIUM confidence)
- FastAPI StreamingResponse SSE pattern -- standard approach documented across multiple sources, no library needed
- Fetch API ReadableStream for SSE -- standard browser API, well-documented

### Tertiary (LOW confidence)
- Ollama pull cancel behavior -- community reports suggest `asyncio.Task.cancel()` works, but exact server-side behavior unclear. Ollama resumes partial downloads regardless.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified
- Architecture (two-tier config): HIGH -- straightforward pattern, UserPreferences table exists
- Architecture (SSE streaming): HIGH -- standard FastAPI pattern, well-documented
- Ollama API: HIGH -- verified against installed v0.6.1 introspection
- Pitfalls: HIGH -- derived from direct codebase analysis
- Cancel mechanism: MEDIUM -- works in theory, edge cases not fully verified
- Curated model list: MEDIUM -- based on general knowledge of model ecosystem, not benchmarked for this specific use case

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days -- stable domain, Ollama API is mature)
