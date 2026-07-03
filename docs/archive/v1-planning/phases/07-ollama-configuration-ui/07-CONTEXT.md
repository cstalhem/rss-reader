# Phase 7: Ollama Configuration UI - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Runtime Ollama configuration without YAML/env changes. Users can manage models, monitor connection health, view system prompts, and trigger re-scoring — all from the settings UI. The Ollama host URL remains a backend config setting.

</domain>

<decisions>
## Implementation Decisions

### Model Management UX
- Model dropdowns show **name + size** (e.g., "llama3.2:3b — 2.0 GB")
- Default to a **single model selector** for both categorization and scoring
- Show a **"Use separate models" toggle only when 2+ models** are available locally
- When split, show a **RAM warning** that both models need to fit in available memory
- Show which model(s) are **currently loaded in Ollama's memory** with a small badge/indicator
- Model changes require an **explicit Save button** (not auto-save on change)
- When changing model during active scoring: **switch after current batch completes**, with an informational message explaining the behavior
- When Ollama is disconnected: **disable dropdowns with a message** ("Connect to Ollama to manage models")

### Config Storage
- Store runtime Ollama preferences (selected models, split toggle) in the **database (UserPreferences table)**, not Pydantic Settings
- YAML config becomes the **initial default only** — runtime changes apply without restart
- This is the two-tier config pattern noted in STATE.md

### Download Experience
- **Curated suggestions**: hardcoded list of 4-6 recommended models for classification/scoring, plus a text input for custom model names
- Already-downloaded models **marked with an "Installed" badge** in the suggestions list (not hidden)
- **Inline progress bar** replacing the Pull button during download, showing percentage and speed
- **Cancel button** available during downloads (Ollama supports aborting pulls)
- **Delete models** from within settings UI with a confirmation dialog
- Model management (download/delete) lives in the **same section** as model selection
- **Backend tracks download state** — user can navigate away and return to see current progress
- **Subtle indicator** on the Ollama settings tab when a download is in progress (visible from other settings sections)

### Re-scoring Workflow
- Scope: re-evaluate **all unread articles**
- **Explicit "Re-evaluate unread articles" button** (generic label) — inactive until relevant settings have changed
- **Smart pipeline**: if categorization model changed, re-run full pipeline (categorize + score); if only scoring model changed, re-run scoring only
- During re-scoring: **preserve old data** but move articles to the **Scoring tab** (away from Unread)
- Uses the **existing scoring status indicator** from Phase 5 for progress feedback — no new progress UI
- Re-scored articles get **priority in the scoring queue** (ahead of newly fetched articles)
- **No cancel** once re-scoring starts — let it finish to avoid mixed-state articles

### Health & Status Presentation
- Connection badge **only in Ollama settings section** (not in app header/sidebar)
- Badge shows: **status (connected/disconnected) + latency + Ollama server version**
- **Auto-refresh every 15-30 seconds** while the Ollama settings section is visible; stops when navigating away

### System Prompts Display
- Read-only text areas showing current categorization and scoring prompts (per success criteria)

### Claude's Discretion
- Exact curated model list (which 4-6 models to recommend)
- Progress bar styling and animation
- Health badge visual design (colors, icon choice)
- Auto-refresh interval (15s vs 30s)
- System prompt text area formatting (syntax highlighting, collapsible, etc.)
- How the "settings changed" detection works for the re-score button activation
- Download speed display format

</decisions>

<specifics>
## Specific Ideas

- Single model selector by default, split toggle only when 2+ models exist — keeps it simple for users with one model
- RAM warning when using separate models is important because Ollama loads each model independently
- The re-score button activation pattern (inactive until settings change) makes cause-and-effect visible
- Backend-tracked download state is essential for navigate-away resilience

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-ollama-configuration-ui*
*Context gathered: 2026-02-15*
