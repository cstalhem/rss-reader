# Deferred Ideas

Future features and improvements to consider for upcoming milestones.

---

## 1. Ollama Configuration UI

**Priority:** High
**Scope:** Frontend settings page + backend API additions

Allow users to view and modify the Ollama/LLM configuration from the frontend UI.

### Requirements

1. **Connection status** — Verify Ollama is connected and reachable; show status indicator
2. **Prompt visibility** — Display the prompts used for scoring and categorization (from `prompts.py`); ideally editable or at least viewable so users understand how the LLM interprets articles
3. **Model selection** — Choose which Ollama model is used for:
   - **Scoring** (interest + quality assessment) — currently `scoring_model` in config
   - **Categorization** (topic tagging) — currently `categorization_model` in config
   - These are already separate steps in the backend (`score_article` + `categorize_article` in `scoring.py`), with separate model configs in `OllamaConfig`
4. **Available models** — List models available on the Ollama instance (via Ollama API `GET /api/tags`)

### Architecture Notes

- Backend already has separate `categorization_model` and `scoring_model` fields in `OllamaConfig`
- Prompts are built by `build_categorization_prompt()` and `build_scoring_prompt()` in `prompts.py`
- Config is currently loaded from YAML/env at startup via Pydantic Settings — making it runtime-editable would require either:
  - Storing overrides in the database (preferred — keeps SQLite as single source of truth)
  - Or a config write-back mechanism
- Ollama client is created per-call, so changing the model at runtime is straightforward

---

## 2. UI Internationalization (i18n)

**Priority:** Low
**Scope:** Frontend infrastructure

Add ability to translate the frontend UI to other languages. Category names remain English-only (enforced in LLM prompt), but UI labels, buttons, empty states, and messages could be localized.

### Notes

- Consider `next-intl` or similar for Next.js App Router i18n
- Categories are always English (by design — LLM prompt enforces this)
- This is purely a UI concern; backend API responses stay in English
