---
status: diagnosed
trigger: "Investigate why the 'Re-evaluate unread articles' button in the Ollama settings doesn't work correctly."
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:04:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Backend re-queue logic is conditional on model change detection. When "Re-evaluate" is clicked, frontend sends current savedConfig (which matches database), backend compares and finds no change, sets rescore_mode=None, skips re-queueing, returns 0, frontend doesn't show toast.
test: Complete trace confirmed theory
expecting: Issue is architectural - rescore should not depend on model change detection
next_action: Document complete root cause for return to caller

## Symptoms

expected: Clicking "Re-evaluate unread articles" button should:
1. Call PUT /api/ollama/config with rescore=true
2. Backend updates articles with scoring_state='scored' and is_read=false to scoring_state='queued', scoring_priority=1
3. Backend returns rescore_queued count > 0
4. Frontend shows toast notification with count

actual: Button becomes active after saving a model change, but clicking it:
1. Does not show a toast notification
2. Does not re-queue already scored, unread articles for re-scoring

errors: None reported

reproduction:
1. Navigate to Ollama settings
2. Change a model
3. Click "Re-evaluate unread articles" button
4. Observe no toast, no re-queueing

started: Unknown (reported as current behavior)

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:03:00Z
  checked: Complete flow from user action to backend response
  found: |
    TRACED COMPLETE FLOW:

    Step 1: User changes model selection
    - localEdits updated → effectiveConfig changes → isDirty=true

    Step 2: User clicks "Save"
    - onSave(false) called with rescore=false
    - saveMutation.mutate({ ...effectiveConfig, rescore: false })
    - Backend saves new model config, returns rescore_queued=0 (expected, rescore was false)

    Step 3: Save success callback
    - setLocalEdits(null) → effectiveConfig now equals serverConfig
    - TanStack Query invalidates "ollama-config" → refetches
    - savedConfig updates to new server config
    - RescoreButton: savedConfig !== initialConfig → button enabled

    Step 4: User clicks "Re-evaluate"
    - onSave(true) called with rescore=true
    - saveMutation.mutate({ ...effectiveConfig, rescore: true })
    - PROBLEM: effectiveConfig === savedConfig at this point (localEdits is null)
    - Backend receives: new_model === old_model (because they're the same!)
    - Backend: cat_changed=False, score_changed=False
    - Backend: rescore_mode=None
    - Backend: if rescore_mode → skipped!
    - Backend: returns rescore_queued=0

    Step 5: Rescore success callback
    - Frontend: if (rescore && result.rescore_queued > 0) → False (0 is not > 0)
    - No toast shown

  implication: ROOT CAUSE CONFIRMED - Backend compares "new" config against "old" config to determine rescore_mode, but when re-evaluate is clicked, the "new" config being sent is already the saved config, so backend sees no change and skips re-queueing entirely.

- timestamp: 2026-02-15T00:01:00Z
  checked: Frontend flow (RescoreButton.tsx, ModelSelector.tsx, OllamaSection.tsx, useOllamaConfig.ts, api.ts)
  found: |
    1. RescoreButton: handleRescore() calls onRescore() prop, which is passed from ModelSelector
    2. ModelSelector: onRescore={() => onSave(true)} - passes true to onSave
    3. OllamaSection: handleSave(rescore: boolean) calls saveMutation.mutate({ ...effectiveConfig, rescore })
    4. useOllamaConfig: saveMutation calls saveOllamaConfig(data) from api.ts
    5. api.ts: saveOllamaConfig sends PUT request with all data including rescore flag
    6. OllamaSection: In onSuccess callback, checks if (rescore && result.rescore_queued > 0) before showing toast

    Frontend flow appears correct. Button calls onSave(true), which includes rescore in the request.
  implication: Frontend logic looks correct. Issue likely in backend or data state.

- timestamp: 2026-02-15T00:02:00Z
  checked: Backend endpoint PUT /api/ollama/config (main.py lines 798-882)
  found: |
    Logic flow:
    1. Receives OllamaConfigUpdate with rescore flag (line 800)
    2. Gets/creates UserPreferences
    3. Determines old config values (lines 820-828)
    4. Saves new config values (lines 831-838)
    5. If update.rescore is True (line 841):
       - Determines rescore_mode by comparing old vs new models (lines 843-856)
       - If rescore_mode is not None (line 857):
         - Queries articles where is_read=False AND scoring_state='scored' (lines 859-863)
         - Updates articles to scoring_state='queued', scoring_priority=1, rescore_mode (lines 865-869)
         - Commits and returns count

    CRITICAL: rescore_mode can be None even when rescore=True!
    - rescore_mode is only set if categorization model changed (full) OR scoring model changed (score_only)
    - If neither model changed, rescore_mode stays None, no articles get queued
  implication: Backend skips re-queueing if models haven't changed. This is likely the root cause.

## Resolution

root_cause: |
  The backend re-queue logic in PUT /api/ollama/config is conditional on detecting a model change:

  1. Backend compares incoming config against stored UserPreferences to determine rescore_mode
  2. rescore_mode is only set if categorization_model OR scoring_model changed
  3. If rescore_mode is None, no articles are re-queued even when rescore=true

  PROBLEM: When user clicks "Re-evaluate", the frontend sends the CURRENT saved config (effectiveConfig, which equals savedConfig after the previous save cleared localEdits). Backend compares this against the database and finds NO CHANGE, so rescore_mode=None and no articles are queued.

  The rescore=true flag is intended to mean "re-queue unread articles for re-scoring with new model", but the backend interprets it as "IF models changed, THEN re-queue". This creates a scenario where:
  - Button becomes enabled after any model save (correct)
  - Clicking it sends rescore=true with unchanged config (frontend bug)
  - Backend sees no change, doesn't re-queue (backend design issue)
  - No toast shown because rescore_queued=0 (correct given previous steps)

  There are TWO issues:
  1. Backend: rescore=true should unconditionally re-queue when requested, not depend on model change detection
  2. Frontend: Button enables when savedConfig changes, but doesn't track whether models specifically changed

  Either fix would resolve the symptom, but the backend design is the more fundamental issue.

fix:
verification:
files_changed: []
