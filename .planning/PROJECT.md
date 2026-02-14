# RSS Reader

## What This Is

A personal RSS reader with LLM-powered content curation. It fetches articles from RSS feeds, displays them in a clean UI, and uses a local Ollama instance to automatically score and surface articles matching your interests — while hiding noise and occasionally surfacing serendipitous finds.

Built for a single user, running on a home server via Docker.

## Core Value

Surface interesting articles and hide noise automatically, so reading RSS feels like having a thoughtful curator rather than drinking from a firehose.

## Requirements

### Validated

- ✓ FastAPI backend with SQLModel ORM and SQLite database — v1.0
- ✓ Feed and Article data models with proper constraints — v1.0
- ✓ RSS feed fetching with feedparser and httpx — v1.0
- ✓ APScheduler for automatic feed refresh every 30 minutes — v1.0
- ✓ REST API: list articles (paginated), update read status, manual refresh — v1.0
- ✓ Graceful error handling for malformed feeds and network failures — v1.0
- ✓ Backend test suite with pytest and pytest-asyncio — v1.0
- ✓ Docker Compose production deployment with persistent volumes, auto-restart, health checks — v1.0
- ✓ Article list with preview cards, read/unread state, load-more pagination — v1.0
- ✓ Article reader drawer with auto-mark-as-read, prev/next navigation — v1.0
- ✓ Dark/light theme toggle with orange accent, Inter + Lora fonts — v1.0
- ✓ Feed management: add, remove, rename, reorder, mark-all-read — v1.0
- ✓ LLM content curation: two-step scoring pipeline, categorization, topic weights — v1.0
- ✓ Interest-driven UI: score badges, sort by score/date, filter tabs, adaptive polling — v1.0

### Active

## Current Milestone: v1.1 Configuration, Feedback & Polish

**Goal:** Make the LLM curation loop configurable and improvable from the UI, add hierarchical category management, and polish the overall experience.

**Target features:**
- [ ] Ollama Configuration UI — connection status, model selection, prompt visibility
- [ ] UI & Theme Polish — design refinements across the app
- [ ] LLM Feedback Loop — explicit user feedback to improve scoring over time
- [ ] Category Grouping — hierarchical groups with cascading weights and per-category overrides

### Out of Scope

- Multi-user support — personal use only, no auth needed
- Cloud deployment — runs on home server
- Mobile native app — web-first, responsive layout is sufficient
- OAuth or social login — single user, no auth
- UI snapshot testing — overkill for personal project
- UI internationalization — low priority, English-only for now
- Real-Time Push Updates (SSE) — deferred to v1.2
- Feed Categories/Folders — deferred to v1.2
- Feed Auto-Discovery — deferred to v1.2

## Context

- Full-stack app operational: FastAPI backend + Next.js/Chakra UI v3 frontend, deployed via Docker Compose on home server.
- LLM scoring pipeline active with Ollama (qwen3:8b default) — two-step categorize → score with composite scoring and topic weights.
- Frontend uses TanStack Query for data layer, adaptive polling for real-time feel, Chakra UI v3 with dark theme + orange accent.
- Ollama config currently only modifiable via YAML/env vars — runtime changes require a settings UI backed by database storage.
- Scoring feedback is currently one-directional (LLM scores, user reads). No mechanism for the user to improve scoring through interaction.
- Testing philosophy: integration tests over unit tests, real SQLite databases over mocks, async-first with pytest-asyncio.

## Constraints

- **Tech stack**: FastAPI + SQLModel + SQLite (backend), Next.js + Chakra UI (frontend), Ollama (LLM) — locked in per PRD
- **Privacy**: All processing local, no external API calls for content analysis
- **Simplicity**: Solo developer, personal use — maintainability over enterprise patterns
- **Database**: SQLite only — no Postgres, no external database services

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Chakra UI v3 for frontend | Prop-based theming, good DX, dark/light mode support built-in | ✓ Good |
| Ollama for LLM (local) | Privacy, no API costs, runs on home server | ✓ Good |
| SQLite over Postgres | Simple, no ops, sufficient for single-user RSS reader | ✓ Good |
| APScheduler over cron/Celery | In-app, Docker-friendly, no external dependencies | ✓ Good |
| TanStack Query for data layer | Caching, background sync, optimistic updates | ✓ Good |
| Two-step LLM pipeline | Categorize all → score non-blocked; separate models configurable | ✓ Good |
| Composite scoring formula | interest * category_weight * quality_multiplier (cap 20.0) | ✓ Good |
| Pydantic Settings config | Type-safe config from env/YAML with lru_cache | ✓ Good |
| Production Docker Compose | Home server with Traefik reverse proxy, GHCR images | ✓ Good |

---
*Last updated: 2026-02-14 after v1.1 milestone scoping*
