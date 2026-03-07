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
uv run dev                                             # Dev server
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
- Merge `dev` → `main` when ready to deploy. **Always use "Create a merge commit"** (never squash or rebase) to preserve shared history between branches. Pushes to `dev` trigger CI builds (validation only, no image push).

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

The purpose of this system is to make each change to the code simpler than the last, by continually capturing gotchas, patterns, and decisions as they're discovered.

Project knowledge lives in three tiers. Each has a distinct purpose and update trigger.

| Tier        | Location                | Loads                | Contains                                               |
| ----------- | ----------------------- | -------------------- | ------------------------------------------------------ |
| Orientation | `{L1_FILE}` (this file) | Always               | Project structure, commands, design assumptions        |
| Rules       | `.claude/rules/`        | Always (path-scoped) | Concise do/don't rules                                 |
| Skills      | `.claude/skills/`       | On demand            | Deep reference: examples, anti-patterns, decision aids |

**Staging area** — the project-specific `MEMORY.md` (at `.claude/projects/<project-hash>/MEMORY.md`) holds unvalidated learnings discovered during work. This file is stable regardless of git worktree, so always use it even when working from a worktree.

**Critical patterns** — `.claude/rules/critical-patterns.md` captures high-impact WRONG/CORRECT patterns for mistakes that break builds, cause data loss, or create security issues.

### Workflow checkpoints

- **Before non-trivial tasks:** Scan `.claude/rules/` (including `critical-patterns.md`) and `.claude/skills/` for knowledge relevant to the task at hand. Skip for trivial changes (typos, copy edits, color tweaks, one-line fixes).
- **After completing tasks:** Check if anything discovered during the task should be staged in `MEMORY.md`.

### Updating the knowledge system

When you discover something worth capturing during work:

1. **Caused by a mistake or gotcha?** → Add a one-line rule to the relevant file in `.claude/rules/`. Update the matching skill's Anti-Patterns section with the full context (what went wrong, why, the fix).
2. **High-impact mistake (build-breaking, data loss, security)?** → Add a WRONG/CORRECT entry to `.claude/rules/critical-patterns.md`.
3. **New pattern, example, or decision aid?** → Update the relevant skill in `.claude/skills/`.
4. **New topic not covered by any existing skill?** → Create a new skill directory with `SKILL.md`. Keep description under 200 chars.
5. **Not validated yet?** → Add an entry to the project's `MEMORY.md` with date, context, and structured tags: `[type:gotcha|pattern|decision]`, `[area:<project-area>]`. Add `[promotion-candidate]` when the pattern recurs across 2+ sessions.

### Cross-referencing

- Rules reference backing skills: `(see skill: skill-name)` for deeper context.
- Skills reference the rules they support for quick lookup.

### Proactive maintenance

- After fixing a bug caused by a missing rule, suggest adding the rule.
- After a session where a skill would have prevented confusion, suggest updating it.
- When `MEMORY.md` staging entries have been validated across 2+ sessions, suggest promotion.
- When a rule or skill leads to incorrect behavior, flag it: critical issues → propose a direct fix (with user approval), minor issues → stage the correction in `MEMORY.md` with `[type:gotcha]` and `[promotion-candidate]` tags.
- Keep rules to one line each — no code examples, no rationale (that belongs in skills).
- Keep skill content timeless — no phase numbers, plan numbers, or session-specific context.
- Surface lint/type/test errors immediately rather than deferring them.

---

## Available MCP Tools

1. **Chakra UI MCP** — Look up Chakra UI v3 component docs, props, and examples
2. **Context7 MCP** — Look up documentation for other libraries (TanStack Query, Next.js, etc.)
