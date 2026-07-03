---
phase: 04-llm-content-curation
plan: 05
subsystem: verification
tags: [ollama, deepseek-r1, scoring, settings-ui, categories]

requires:
  - phase: 04-01
    provides: Data models, preferences API, Ollama Docker service
  - phase: 04-02
    provides: Two-step LLM scoring pipeline with queue
  - phase: 04-03
    provides: Settings page with preferences editor
  - phase: 04-04
    provides: Article UI with tags, scores, quick-block/boost

provides:
  - Human-verified LLM content curation system
  - Verified scoring pipeline with deepseek-r1:8b
  - Polished article list and reader UI with scoring info

affects: [05-interest-driven-ui]

tech-stack:
  added: []
  patterns:
    - "SQLite ALTER TABLE migration on startup for schema changes"
    - "busy_timeout pragma for concurrent write tolerance"
    - "Orphaned state recovery on startup"
    - "Conditional TanStack Query polling during active scoring"

key-files:
  created: []
  modified:
    - backend/src/backend/database.py
    - backend/src/backend/main.py
    - backend/src/backend/config.py
    - backend/src/backend/prompts.py
    - backend/src/backend/scoring_queue.py
    - frontend/src/app/settings/page.tsx
    - frontend/src/components/article/ArticleList.tsx
    - frontend/src/components/article/ArticleRow.tsx
    - frontend/src/components/article/TagChip.tsx
    - frontend/src/components/layout/Header.tsx
    - frontend/src/hooks/useArticles.ts

key-decisions:
  - "SQLite busy_timeout=5000ms prevents database locked errors during concurrent scoring and API writes"
  - "Recover orphaned scoring state on startup — reset scoring→queued automatically"
  - "Reassign JSON column dicts instead of in-place mutation for SQLAlchemy change detection"
  - "Default Ollama model changed to deepseek-r1:8b (user's available model)"
  - "Categorization prompt: max 4 broad kebab-case categories, ignore incidental mentions"
  - "Seed /api/categories with DEFAULT_CATEGORIES for first-time setup"
  - "Conditional polling: refetch articles every 5s while scoring is active"
  - "Feed name shown in article rows only in all-articles view, hidden for single-feed"
  - "Single orange toggle dot replaces dual read/unread indicators"

patterns-established:
  - "SQLite migration pattern: inspect columns, ALTER TABLE for missing ones, idempotent on restart"
  - "Startup recovery: reset transient states (scoring→queued) that indicate interrupted work"
  - "Conditional polling via TanStack Query refetchInterval function"

duration: ~45min
completed: 2026-02-13
---

# Plan 05: Human Verification Summary

**Verified complete LLM curation system end-to-end: scoring pipeline with deepseek-r1:8b, settings page, article UI with tags/scores, fixed 6 issues found during testing**

## Performance

- **Duration:** ~45 min (interactive verification + fixes)
- **Tasks:** 1 (human verification checkpoint)
- **Files modified:** 11

## Accomplishments
- Verified settings page (interests, anti-interests, category weights) works end-to-end
- Verified scoring pipeline categorizes and scores articles via Ollama
- Verified article list and reader display tags, scores, and reasoning
- Fixed 6 issues discovered during verification

## Task Commits

1. **Backend fixes** - `8db5390` (fix: DB migration, busy_timeout, stuck recovery, JSON mutation, model config, prompt improvements)
2. **Frontend polish** - `4b193bf` (fix: settings header, feed names, inline tags, toggle dot, tag contrast, auto-polling)

## Issues Found and Fixed

1. **Missing columns on existing DB** — `create_all()` doesn't ALTER existing tables. Added startup migration with `inspect()` + `ALTER TABLE`.
2. **Database locked during scoring** — Added `PRAGMA busy_timeout=5000` so API writes wait instead of failing.
3. **Orphaned articles in "scoring" state** — Added startup recovery to reset scoring→queued.
4. **Category weights not saving** — SQLAlchemy JSON column in-place dict mutation not detected. Fixed by reassigning with new dict.
5. **Category proliferation** — Tightened prompt to max 4 broad kebab-case categories, ignore incidental mentions. Added server-side normalization.
6. **UI polish** — Settings page missing header, hardcoded "Feed" text, redundant read indicators, low-contrast tags, no live scoring updates.

## Next Phase Readiness
- Phase 4 complete — all scoring infrastructure, settings, and article UI verified
- Ready for Phase 5: Interest-Driven UI (sort/filter by score)

---
*Phase: 04-llm-content-curation*
*Completed: 2026-02-13*
