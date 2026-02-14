# AGENTS.md

## Project Overview

A personal RSS reader with LLM-powered relevance scoring. Local-first, simple, maintainable.

**Stack:** FastAPI + SQLModel (backend) | Next.js + Chakra UI v3 (frontend) | SQLite | Ollama

---

## Directory Structure

| Directory | Contents |
|-----------|----------|
| `backend/` | Python/FastAPI API server with SQLModel models |
| `frontend/` | Next.js App Router with Chakra UI v3 components |
| `config/` | Production YAML configuration (`app.yaml`) |
| `spec/` | PRD and milestone implementation plans |
| `.planning/` | GSD workflow: roadmap, phase plans, research, state tracking |
| `.github/workflows/` | CI/CD: Docker image builds pushed to GHCR |
| `data/` | SQLite database (gitignored) |

---

## Commands

### Backend (`cd backend`)

```bash
uv run uvicorn backend.main:app --reload --port 8912  # Dev server
uv run pytest                                          # Tests
uv run ruff check .                                    # Lint
uv run ruff format .                                   # Format
```

### Frontend (`cd frontend`)

```bash
bun dev --port 3210   # Dev server (uses --webpack, NOT turbopack)
bun run lint          # ESLint
bun run build         # Production build
```

---

## Critical Patterns and Gotchas

### Frontend

**Chakra UI v3 — Portal/Positioner pattern (REQUIRED for overlays):**
Select, Menu, Tooltip, and Popover components MUST use `Portal > Component.Positioner > Component.Content`. Without this, dropdowns render inline and cause layout shift. See `SortSelect.tsx` and `TagChip.tsx` for correct examples. Chakra v3 uses dot notation (`Select.Root`, `Menu.Item`) not flat imports.

**Chakra UI v3 — Theme system:**
Theme is built with `createSystem(defaultConfig, {...})` in `frontend/src/theme/index.ts`. Color palette uses `accent` (orange) as the primary colorPalette. Semantic tokens must include `solid`, `contrast`, and `focusRing` for colorPalette resolution to work. The full token set is in `theme/colors.ts`.

**Turbopack breaks Emotion SSR:**
Turbopack mishandles Emotion CSS server-side rendering, causing hydration errors (`<script>` vs `<style data-emotion>` mismatch). The dev and build scripts in `package.json` use `--webpack` flag as a workaround. Do NOT remove this flag. `suppressHydrationWarning` on `<html>` in `layout.tsx` is also required.

**localStorage and hydration:**
Never read localStorage in `useState` initializer — the server renders `initialValue` but the client would read the stored value, causing a hydration mismatch. Pattern: initialize with default, sync from localStorage in `useEffect` after hydration. See `useLocalStorage.ts`.

**Server/Client component boundary:**
Server Components cannot pass functions (callbacks, render props) to Client Components. Only serializable data crosses the boundary. Prefer direct composition inside Client Components.

**`NEXT_PUBLIC_*` env vars are baked at build time:**
These are replaced with literal values during the webpack build. Setting them in docker-compose `environment` has NO effect on client-side code. The production Dockerfile sets `NEXT_PUBLIC_API_URL=""` as a build arg so API calls use relative URLs routed by Traefik.

**Emotion `keyframes` helper:**
Cannot define `@keyframes` inline in the `css` prop. Must use the `keyframes` tagged template from `@emotion/react` and reference the result.

### Backend

**Pydantic Settings config priority:**
Config loads in order: env vars > `.env` file > YAML config (`CONFIG_FILE` env var) > defaults in `config.py`. Nested env vars use double-underscore notation (e.g., `OLLAMA__HOST`). Settings are cached via `@lru_cache` — requires restart to pick up changes.

**SQLite pragmas (set on every connection):**
WAL mode, `busy_timeout=5000ms`, foreign keys ON, 64MB cache. Set via SQLAlchemy `connect` event in `database.py`. WAL mode prevents "database is locked" errors during concurrent scoring/API access.

**Scoring pipeline (two-step):**
1. `categorize_article()` — assigns up to 4 kebab-case English categories using `categorization_model`
2. `score_article()` — evaluates interest (0-10) and quality (0-10) using `scoring_model`
These use separate Ollama models (configurable independently). The scoring queue in `main.py` processes batches of 5 articles every 30 seconds, oldest first.

**SQLAlchemy JSON column mutation:**
SQLAlchemy does NOT detect in-place mutations to JSON columns (dicts/lists). You must reassign the entire value: `obj.field = {**obj.field, key: value}` instead of `obj.field[key] = value`. Failing to do this causes silent data loss.

**Startup recovery:**
`database.py` resets articles stuck in `scoring_state='scoring'` back to `queued` on startup, handling cases where the process was killed mid-scoring.

**Article lifecycle (scoring states):**
`unscored` → `queued` → `scoring` → `scored` (or `failed`). Articles only appear in Unread/All views after reaching `scored` state with `composite_score != 0`. Articles with score 0 (all categories blocked) appear only in the Blocked tab.

---

## Project Conventions

### Design Assumptions

- **Single-user app** — No authentication, no multi-tenancy. One UserPreferences row, one SQLite database.
- **Local-first** — All data and processing stays on the user's machine. No external APIs or telemetry.
- **Let package managers manage dependency files** — Don't manually edit `pyproject.toml` or `package.json`. Use `uv add`, `bun add`, etc.

### Frontend Conventions

- **Semantic tokens over raw colors** — Use `bg.subtle`, `fg.muted`, `fg.default`, `border.subtle`, `accent.solid`, etc. Never hardcode hex/oklch values in components.
- **`colorPalette="accent"`** for all primary actions and CTAs (buttons, links, badges).
- **Inter** for UI text, **Lora** for article reader content. Defined in `theme/typography.ts`.
- **TanStack Query** for all server state. No `useEffect` + `useState` fetch patterns. Client preferences (sort order, sidebar collapse) use `useLocalStorage`.
- **Adaptive polling** — Poll intervals adjust based on application state (e.g., faster during active scoring, slower when idle). Don't use fixed intervals.
- **Custom hooks in `src/hooks/`**, prefixed with `use`. API client functions in `src/lib/api.ts`, shared types in `src/lib/types.ts`.
- **`"use client"` directive** on all interactive components. Only `layout.tsx` and `page.tsx` are Server Components.

### Backend Conventions

- **All API routes prefixed with `/api/`** — e.g., `/api/articles`, `/api/feeds`, `/api/preferences`.
- **SQLModel for models** — not raw SQLAlchemy ORM classes. Models live in `models.py`.
- **Categories are kebab-case, lowercase, English-only** — normalized on storage. The LLM prompt enforces English regardless of article language.
- **feedparser** for RSS/Atom parsing. **APScheduler** for background jobs (feed refresh, scoring queue).
- **Schema migrations are manual** — `database.py` runs `ALTER TABLE ADD COLUMN` checks on startup for columns that `create_all` doesn't handle on existing tables.

### UI/UX Conventions

- **Dark mode default** with orange accent (`oklch(64.6% 0.222 41.116)`).
- **Load-more pagination** — not infinite scroll. User explicitly requests more.
- **Unread-first default view**, sorted by composite score descending.
- **12-second auto-mark-as-read** in the reader drawer.
- **Relaxed list layout** — generous padding (`py=3 px=4`), breathing room between elements.
- **Read state indicators** — full opacity + accent dot for unread, 0.6 opacity + hollow dot for read.

---

## Deployment

Two Docker images published to GHCR via GitHub Actions (`.github/workflows/docker-publish.yml`):
- `ghcr.io/cstalhem/rss-reader/backend:latest`
- `ghcr.io/cstalhem/rss-reader/frontend:latest`

Production compose (`docker-compose.prod.yml`) uses Traefik labels for reverse proxy routing. The frontend image is built with relative API URLs — Traefik routes `PathPrefix('/api')` to the backend, all other requests to the frontend.

Development compose (`docker-compose.yml`) builds locally and exposes ports directly.

---

## Testing Principles

1. **Integration over unit tests** — Test real workflows, not implementation details
2. **Real databases** — Use SQLite test databases via fixtures, avoid mocking
3. **Async-first** — Use `pytest-asyncio` for FastAPI endpoints
4. **Test important paths** — Feed fetching, article display, read/unread state
5. **Don't over-invest** — Skip exhaustive CRUD unit tests and UI snapshots

---

## Available MCP Tools

1. **Chakra UI MCP** — Look up Chakra UI v3 component docs, props, and examples
2. **Context7 MCP** — Look up documentation for other libraries (TanStack Query, Next.js, etc.)
