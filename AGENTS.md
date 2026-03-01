# AGENTS.md

## Project Overview

A personal RSS reader with LLM-powered relevance scoring. Local-first, simple, maintainable.

**Stack:** FastAPI + SQLModel (backend) | Next.js + Chakra UI v3 (frontend) | SQLite | Ollama

---

## Directory Structure

| Directory            | Contents                                                     |
| -------------------- | ------------------------------------------------------------ |
| `backend/`           | Python/FastAPI API server with SQLModel models               |
| `frontend/`          | Next.js App Router with Chakra UI v3 components              |
| `config/`            | Production YAML configuration (`app.yaml`)                   |
| `spec/`              | PRD and milestone implementation plans                       |
| `.planning/`         | GSD workflow: roadmap, phase plans, research, state tracking |
| `.claude/rules/`     | Concise do/don't rules, loaded by file path context          |
| `.claude/skills/`    | Deep reference: examples, anti-patterns, decision aids       |
| `.github/workflows/` | CI/CD: Docker image builds pushed to GHCR                    |
| `data/`              | SQLite database (gitignored)                                 |

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

## Design Assumptions

- **Single-user app** — No authentication, no multi-tenancy. One UserPreferences row, one SQLite database.
- **Local-first** — All data and processing stays on the user's machine. No external APIs or telemetry.
- **Let package managers manage dependency files** — Don't manually edit `pyproject.toml` or `package.json`. Use `uv add`, `bun add`, etc.

---

## Branching

- **`main`** — Production. Always deployable. Docker images are built and pushed to GHCR on every push here.
- **`dev`** — Development. All day-to-day work (GSD phases, bug fixes, features) happens here.
- Merge `dev` → `main` when ready to deploy. Pushes to `dev` trigger CI builds (validation only, no image push).

## Pull Requests

When creating PRs, use this body template:

```
# <Short title, max 72 chars>

## What is this PR about?

1-2 sentences. What changed in plain language.

## Why is this change needed?

1-2 sentences. Problem/user impact.

## How is this change implemented?

3-5 bullets max. High-level only, no deep technical details.

## How to test this change?

Non-technical, step-by-step.

1. ...
2. ...
3. ...

## Notes

For example:
- Reviewer focus/risk areas
- Any migration/seed/env prerequisite
- Known limitation (if any)
```

## Deployment

Two Docker images published to GHCR via GitHub Actions (`.github/workflows/docker-publish.yml`):
- `ghcr.io/cstalhem/rss-reader/backend:latest`
- `ghcr.io/cstalhem/rss-reader/frontend:latest`

Images are only pushed on merges to `main` or version tags. Pushes to `dev` and PRs run the build for validation without publishing.

The frontend image is built with relative API URLs — a reverse proxy routes `PathPrefix('/api')` to the backend, all other requests to the frontend. See `README.md` for an example Docker Compose setup.

---

## Testing Principles

1. **Use red/green testing** - Always follow this convention when working
2. **Integration over unit tests** — Test real workflows, not implementation details
3. **Real databases** — Use SQLite test databases via fixtures, avoid mocking
4. **Async-first** — Use `pytest-asyncio` for FastAPI endpoints
5. **Test important paths** — Feed fetching, article display, read/unread state
6. **Don't over-invest** — Skip exhaustive CRUD unit tests and UI snapshots
7. **Use the Rodney-cli** — Always verify UI implementations with `uvx rodney --help` interactively

---

## Knowledge System

Project knowledge lives in three tiers. Each has a distinct purpose and update trigger.

| Tier        | Location                | Loads                | Contains                                               |
| ----------- | ----------------------- | -------------------- | ------------------------------------------------------ |
| Orientation | `AGENTS.md` (this file) | Always               | Project structure, commands, design assumptions        |
| Rules       | `.claude/rules/`        | Always (path-scoped) | Concise do/don't rules                                 |
| Skills      | `.claude/skills/`       | On demand            | Deep reference: examples, anti-patterns, decision aids |

**Auto memory** (`MEMORY.md`) is a staging area for learnings discovered during work.

### Updating the knowledge system

When you discover something worth capturing during work:

1. **Caused by a mistake or gotcha?** → Add a one-line rule to the relevant file in `.claude/rules/`. Then update the matching skill's Anti-Patterns section with the full context (what went wrong, why, the fix).
2. **New pattern, example, or decision aid?** → Update the relevant skill in `.claude/skills/`.
3. **New topic not covered by any existing skill?** → Create a new skill directory with `SKILL.md`. Keep description under 200 chars.
4. **Not validated yet?** → Note it in `MEMORY.md`. Promote to a rule or skill when the pattern recurs.

After promotion from `MEMORY.md`, remove the entry to avoid duplication.

### Proactive maintenance

- After fixing a bug caused by a missing rule, suggest adding the rule.
- After a session where a skill would have prevented confusion, suggest updating it.
- When `MEMORY.md` entries have been validated across 2+ sessions, suggest promotion.
- Keep rules to one line each — no code examples, no rationale (that belongs in skills).
- Keep skill content timeless — no phase numbers, plan numbers, or session-specific context.
- Surface lint/type/test errors immediately rather than deferring them.

---

## Available MCP Tools

1. **Chakra UI MCP** — Look up Chakra UI v3 component docs, props, and examples
2. **Context7 MCP** — Look up documentation for other libraries (TanStack Query, Next.js, etc.)
