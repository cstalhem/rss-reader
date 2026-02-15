---
status: diagnosed
trigger: "Investigate why pulling a non-existent Ollama model shows a progress bar that completes instantly instead of an error message."
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:05:30Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Ollama returns error as stream data, not exception. Frontend never checks for error field in SSE chunks.
test: Verify the data flow through backend to frontend
expecting: Backend passes through chunks including error, frontend ignores error field
next_action: Document root cause

## Symptoms

expected: Error message displayed when pulling non-existent model
actual: Progress bar fills instantly and disappears, no error shown
errors: None visible to user
reproduction: Enter non-existent model name, click Pull button
started: Unknown (reported behavior)

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: Backend endpoint (main.py:730-744)
  found: |
    - POST /api/ollama/models/pull creates SSE stream from ollama_service.pull_model_stream
    - Has try/except that yields error event: `{'status': 'error', 'error': str(e)}`
    - Yields `{'status': 'complete'}` on success
  implication: Backend HAS error handling structure in place

- timestamp: 2026-02-15T00:01:30Z
  checked: ollama_service.py pull_model_stream (lines 82-137)
  found: |
    - Uses AsyncClient.pull(model, stream=True) and yields chunks directly
    - No try/except around the async for loop
    - Exception would propagate up to main.py's event_stream handler
  implication: Backend relies on exception being raised by Ollama client

- timestamp: 2026-02-15T00:02:00Z
  checked: Frontend useModelPull.ts (lines 83-184)
  found: |
    - Parses SSE lines starting with "data: "
    - Only reads status, completed, total fields
    - No check for status === "error" or error field
    - Has try/catch around fetch, but only for network errors
    - Line 110-114 checks response.ok but that's HTTP status, not SSE content
  implication: Frontend never checks for error events in SSE stream content

- timestamp: 2026-02-15T00:02:30Z
  checked: Frontend ModelManagement.tsx (lines 285-289)
  found: |
    - Renders pullHook.error if it exists
    - pullHook.error is only set in catch block (network/HTTP errors)
    - SSE error events never populate this field
  implication: UI has error display, but hook never sets error from SSE error events

- timestamp: 2026-02-15T00:03:00Z
  checked: Direct curl test to Ollama API
  found: |
    curl to /api/pull with nonexistent model returns:
    {"status":"pulling manifest"}
    {"error":"pull model manifest: file does not exist"}

    CRITICAL: Error is sent as a JSON object with "error" field, NOT as exception
    The stream returns normally with data containing error field
  implication: Ollama API returns errors IN THE STREAM, not as HTTP errors or exceptions

- timestamp: 2026-02-15T00:04:00Z
  checked: Backend flow trace (ollama_service.py + main.py)
  found: |
    1. ollama_service.pull_model_stream yields chunks from client.pull()
    2. Ollama client yields: {"status": "pulling manifest"}, then {"error": "..."}
    3. Backend yields these AS-IS: `yield {"status": ..., "completed": ..., "total": ..., "digest": ...}`
    4. Backend then yields `{"status": "complete"}` after loop ends normally
    5. The try/except in main.py never catches anything because no exception is raised
  implication: Backend streams error chunk, then streams "complete" status. No exception raised.

- timestamp: 2026-02-15T00:05:00Z
  checked: Frontend parsing (useModelPull.ts lines 127-154)
  found: |
    Frontend parses each SSE line:
    - Reads data.status, data.completed, data.total
    - NEVER checks for data.error field
    - Updates progress based on status/completed/total
    - For {"error": "..."} chunk, status is undefined, completed/total are 0
    - This becomes progress: {status: "downloading", completed: 0, total: 0, percentage: 0}
    - Stream ends, shows 100% complete (line 160-162)
  implication: Error chunk is processed as normal progress with 0/0, then "completes"

## Resolution

root_cause: |
  When pulling a non-existent Ollama model, the Ollama API returns error information
  as a JSON object in the stream with an "error" field: `{"error": "pull model manifest: file does not exist"}`.

  The backend (ollama_service.py) passes these chunks through unchanged to the SSE stream.
  The frontend (useModelPull.ts) parses SSE chunks but ONLY reads the status, completed,
  total, and digest fields. It never checks for the presence of an "error" field.

  When the error chunk arrives:
  1. Backend yields it unchanged (line ~110-127 in ollama_service.py)
  2. Frontend parses it but ignores the "error" field (line 130-149 in useModelPull.ts)
  3. Frontend treats it as progress with completed=0, total=0
  4. Stream ends normally
  5. Frontend shows 100% complete and clears (line 160-167)
  6. No error is ever displayed to the user

  The try/catch in main.py (line 741-742) only catches exceptions from the generator itself,
  not error responses embedded in the stream data. The Ollama client doesn't raise
  exceptions for model-not-found errors; it returns them as stream data.

fix:
verification:
files_changed: []
