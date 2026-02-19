# AGENTS.md

## Project Overview

A personal RSS reader with LLM-powered relevance scoring. Local-first, simple, maintainable.

**Stack:** FastAPI + SQLModel (backend) | Next.js + Chakra UI v3 (frontend) | SQLite | Ollama

---

## Directory Structure

| Directory            | Contents                                                           |
| -------------------- | ------------------------------------------------------------------ |
| `backend/`           | Python/FastAPI API server with SQLModel models                     |
| `frontend/`          | Next.js App Router with Chakra UI v3 components                    |
| `config/`            | Production YAML configuration (`app.yaml`)                         |
| `spec/`              | PRD and milestone implementation plans                             |
| `.planning/`         | GSD workflow: roadmap, phase plans, research, state tracking       |
| `.learning/`         | Living knowledge base: best practices, patterns, agent mistake log |
| `.github/workflows/` | CI/CD: Docker image builds pushed to GHCR                          |
| `data/`              | SQLite database (gitignored)                                       |

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

> Rationale, code examples, and edge cases for these rules live in `.learning/`. See `.learning/INDEX.md`.

### Frontend

**Chakra UI v3 — Overlays:** Select, Menu, Tooltip, Popover MUST use `Portal > Positioner > Content`. **Exception:** Dialog handles portalling internally — do NOT wrap in Portal. Always use the `@/components/ui/tooltip` wrapper — never raw `Tooltip.Root`. *(details: `.learning/chakra-ui-v3.md`)*

**Chakra UI v3 — React-icons:** Set `color` on the nearest Chakra parent element; CSS inheritance flows to SVG `currentColor`. Do NOT use `var(--chakra-colors-*)` strings on icon props. *(details: `.learning/chakra-ui-v3.md`)*

**Chakra UI v3 — Theme:** Built with `createSystem(defaultConfig, {...})` in `frontend/src/theme/index.ts`. Semantic tokens in `theme/colors.ts`. `colorPalette` requires `solid`, `contrast`, and `focusRing` tokens to resolve.

**Turbopack breaks Emotion SSR:** Dev and build scripts use `--webpack` flag. Do NOT remove. `suppressHydrationWarning` on `<html>` in `layout.tsx` is also required.

**localStorage and hydration:** Never read localStorage in `useState` initializer — causes hydration mismatch. See `useLocalStorage.ts`. *(details: `.learning/nextjs-app-router.md`)*

**Server/Client boundary:** Server Components cannot pass functions to Client Components. Only serializable data crosses the boundary. *(details: `.learning/nextjs-app-router.md`)*

**`NEXT_PUBLIC_*` env vars:** Baked at build time via string replacement. Runtime `environment` in docker-compose has NO effect on client code.

**Emotion `keyframes`:** Cannot define inline in `css` prop. Use `keyframes` tagged template from `@emotion/react`.

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

- **Semantic tokens only** — Never hardcode color values or raw palette refs in components. Missing token? Create one in `theme/colors.ts`. *(details: `.learning/chakra-ui-v3.md`)*
- **`colorPalette="accent"`** per-component on CTAs. Do NOT set as global default.
- **Inter** for UI text, **Lora** for reader content. Defined in `theme/typography.ts`.
- **TanStack Query** for all server state. No `useEffect` + `useState` fetch patterns. *(details: `.learning/tanstack-query.md`)*
- **Mutation error handling** — Centralized via `MutationCache.onError`. Per-mutation `onError` only for overrides. No silent failures. *(details: `.learning/tanstack-query.md`)*
- **Hook return contracts** — Return mutation objects directly. Do NOT wrap in thin functions that hide `isPending`/`mutateAsync`. *(details: `.learning/tanstack-query.md`)*
- **Query keys** — Centralized in `lib/queryKeys.ts`. No inline string literals.
- **Adaptive polling** — Intervals adjust based on app state. No fixed intervals.
- **No unnecessary `useEffect`** — Not for derived state, event responses, or prop-change resets. *(details: `.learning/react-hooks.md`)*
- **`"use client"`** on interactive components only. `layout.tsx` and `page.tsx` are Server Components.
- **Named constants** — Shared: `lib/constants.ts`. Single-use: named `const` at top of file. No magic numbers.

### Frontend File Organization

- **Types** (`interface`, `type`) — `src/lib/types.ts`
- **Runtime utilities** (pure functions) — `src/lib/utils.ts`
- **API client** (fetch functions) — `src/lib/api.ts`
- **Shared constants** (cross-file) — `src/lib/constants.ts`
- **Query keys** — `src/lib/queryKeys.ts`
- **Custom hooks** — `src/hooks/`, prefixed with `use`
- **Shared UI components** — `src/components/ui/`

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
6. **Use the Rodney-cli** — Always verify UI implementations with `uvx rodney --help` interactively

---

## Learning System

The `.learning/` directory contains rationale, examples, trade-offs, and decision aids behind the rules in this file. See `.learning/INDEX.md` for the full listing.

**Boundary:** AGENTS.md has short, actionable rules. `.learning/` has the WHY — rationale, code examples, edge cases, decision aids, and mistake logs. Do not duplicate explanations between them.

**Before implementing:** Check `.learning/INDEX.md` for relevant topic files. Read only what applies to the work at hand.

**When to amend an existing file:**
- The learning relates to a topic that already has a file (e.g., a new React hook pattern → `react-hooks.md`)
- A mistake was made in an area already covered — add it under the relevant topic's Anti-Patterns section
- An existing entry needs correction or a new edge case was discovered

**When to create a new file:**
- The learning covers a distinct topic not represented by any existing file
- An existing file would become unfocused if the content were added to it
- Name the file descriptively (`component-patterns.md`, not `misc.md`). Update `INDEX.md` with a one-line description.

**Mistake logging:** When an agent makes a mistake that required fixing, document the mistake and fix in the relevant topic file (preferred) or `common-mistakes.md` (if cross-cutting). Include: what went wrong, why, and the fix.

---

## Available MCP Tools

1. **Chakra UI MCP** — Look up Chakra UI v3 component docs, props, and examples
2. **Context7 MCP** — Look up documentation for other libraries (TanStack Query, Next.js, etc.)
