# AGENTS.md

## Project Overview

A personal RSS reader with LLM-powered relevance scoring. Local-first, simple, maintainable.

**Stack:** FastAPI + SQLModel (backend) | Next.js + Chakra UI (frontend) | SQLite | Ollama

---

## Directory Structure

| Directory | Contents |
|-----------|----------|
| `backend/` | Python/FastAPI API server with SQLModel models |
| `frontend/` | Next.js App Router with Chakra UI components |
| `spec/` | PRD, milestones, and implementation plans |
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
bun dev --port 3210   # Dev server
bun run lint          # ESLint
```

---

## Spec Directory

- **`spec/prd.md`** — Product requirements, tech stack, data model, testing philosophy
- **`spec/milestone-1/`** — MVP implementation plan (current)
- Future milestones: Feed management (M2), LLM scoring (M3), Polish (M4)

---

## Testing Principles

From the PRD — follow these when writing tests:

1. **Integration over unit tests** — Test real workflows, not implementation details
2. **Real databases** — Use SQLite test databases via fixtures, avoid mocking
3. **Async-first** — Use `pytest-asyncio` for FastAPI endpoints
4. **Test important paths** — Feed fetching, article display, read/unread state
5. **Don't over-invest** — Skip exhaustive CRUD unit tests and UI snapshots

---

## Available tools

1. The Chakra MCP - Use this to lookup ChakraUI documentation
2. Context7 MCP - Use this to lookup other documentation that is not Chakra
