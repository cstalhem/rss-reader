---
paths: ["backend/**"]
---

# Backend Rules

## API & Models

- All API routes prefixed with `/api/`.
- List endpoints must use lightweight schemas — omit large fields (HTML content, summaries) only needed in detail views.
- SQLModel for models — not raw SQLAlchemy ORM classes. Models live in `models.py`.
- Categories are kebab-case, lowercase, English-only — normalized on storage.
- REST naming: nouns in URLs, HTTP methods as verbs. Action endpoints use POST with a noun (`POST /downloads` not `POST /pull`). Singleton resources skip IDs (`/api/preferences`, `/api/ollama/downloads`).
- Don't mix CRUD with actions — saving config and triggering rescore are separate endpoints, not one overloaded call.
- FastAPI `dependency_overrides` keys by function object — tests must import `get_session` from the same module as routers (`deps.py`).

## SQLAlchemy / SQLite

- SQLAlchemy does NOT detect in-place mutations to JSON columns. Reassign the entire value: `obj.field = {**obj.field, key: value}` — never mutate in place.
- Schema versioning via `schema_version` table in `database.py` — version-gated migrations run once per version bump, not every startup.
- Don't use raw SQL to INSERT into ORM-modeled tables — bypasses Python-level defaults (`Field(default=...)`) and breaks when new NOT NULL columns are added. Use `Session(bind=conn)` + ORM objects instead.

## Dependencies & Background Jobs

- **feedparser** for RSS/Atom parsing. **APScheduler** for background jobs (feed refresh, scoring queue).
- `ollama.AsyncClient` is NOT an async context manager — use `client = AsyncClient(...)` directly, never `async with`.

## Configuration

- Config priority: env vars > `.env` file > YAML config (`CONFIG_FILE`) > defaults in `config.py`.
- Nested env vars use double-underscore notation (e.g., `OLLAMA__HOST`).
- Settings cached via `@lru_cache` — requires restart to pick up changes.
