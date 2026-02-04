# RSS Reader

## What This Is

A personal RSS reader with LLM-powered content curation. It fetches articles from RSS feeds, displays them in a clean UI, and uses a local Ollama instance to automatically score and surface articles matching your interests — while hiding noise and occasionally surfacing serendipitous finds.

Built for a single user, running on a home server via Docker.

## Core Value

Surface interesting articles and hide noise automatically, so reading RSS feels like having a thoughtful curator rather than drinking from a firehose.

## Requirements

### Validated

- ✓ FastAPI backend with SQLModel ORM and SQLite database — existing
- ✓ Feed and Article data models with proper constraints — existing
- ✓ RSS feed fetching with feedparser and httpx — existing
- ✓ APScheduler for automatic feed refresh every 30 minutes — existing
- ✓ REST API: list articles (paginated), update read status, manual refresh — existing
- ✓ Graceful error handling for malformed feeds and network failures — existing
- ✓ Backend test suite with pytest and pytest-asyncio — existing

### Active

**M1 — MVP (current focus):**
- [ ] Article list view with preview cards (title, snippet, source, date)
- [ ] Article detail view with in-app reader and link to original
- [ ] Mark articles as read/unread from the UI
- [ ] Dark/light theme toggle (Chakra UI)
- [ ] Docker Compose setup for production deployment (backend + frontend, persistent volumes, auto-restart)

**M2 — Feed Management:**
- [ ] Add feeds via UI
- [ ] Remove feeds via UI
- [ ] Feed groups / categories
- [ ] Filter articles by feed or group

**M3 — LLM Scoring:**
- [ ] Ollama integration for local LLM inference
- [ ] Prose-style user preferences storage
- [ ] Multi-stage filtering pipeline (keyword filters → LLM scoring)
- [ ] Interest scoring with categories (high / medium / low / serendipity)
- [ ] Surface high-interest articles prominently, deprioritize low-interest
- [ ] Serendipity factor to prevent filter bubbles

**M4 — Polish:**
- [ ] Full-text search (SQLite FTS5)
- [ ] Keyboard shortcuts
- [ ] Mobile-responsive layout
- [ ] Data retention / cleanup to prevent database bloat

### Out of Scope

- Multi-user support — personal use only, no auth needed
- Cloud deployment — runs on home server
- Mobile native app — web-first, responsive layout is sufficient
- Real-time push updates — polling/refresh is fine for RSS
- OAuth or social login — single user, no auth
- UI snapshot testing — overkill for personal project

## Context

- Backend is built and functional (M1 backend complete). Frontend has a Next.js skeleton but no UI components yet.
- Chakra UI selected for the frontend component library. An MCP server for Chakra UI is configured in `.mcp.json`.
- Ollama will run locally alongside the app for LLM scoring (M3). No external API costs.
- The app will run on a home server via Docker Compose — needs to be production-ready with persistent volumes and auto-restart.
- Testing philosophy: integration tests over unit tests, real SQLite databases over mocks, async-first with pytest-asyncio.
- The LLM scoring vision is documented in `spec/llm_scoring_vision.md` with details on the multi-stage pipeline, preference format, and output schema.

## Constraints

- **Tech stack**: FastAPI + SQLModel + SQLite (backend), Next.js + Chakra UI (frontend), Ollama (LLM) — locked in per PRD
- **Privacy**: All processing local, no external API calls for content analysis
- **Simplicity**: Solo developer, personal use — maintainability over enterprise patterns
- **Database**: SQLite only — no Postgres, no external database services

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Chakra UI for frontend | Prop-based theming, good DX, dark/light mode support built-in | — Pending |
| Ollama for LLM (local) | Privacy, no API costs, runs on home server | — Pending |
| SQLite over Postgres | Simple, no ops, sufficient for single-user RSS reader | ✓ Good |
| APScheduler over cron/Celery | In-app, Docker-friendly, no external dependencies | ✓ Good |
| Preview cards for article list | Better for skimming content vs minimal rows | — Pending |
| In-app reader + link to original | Flexibility to read inline or visit source | — Pending |
| Dark/light theme toggle | Personal preference, Chakra UI makes this straightforward | — Pending |
| Production Docker Compose | Home server deployment, needs robustness (volumes, restart) | — Pending |

---
*Last updated: 2026-02-04 after initialization*
