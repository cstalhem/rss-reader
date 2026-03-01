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

## SQLAlchemy / SQLite

- SQLAlchemy does NOT detect in-place mutations to JSON columns. Reassign the entire value: `obj.field = {**obj.field, key: value}` — never mutate in place.
- Schema versioning via `schema_version` table in `database.py` — version-gated migrations run once per version bump, not every startup.
- In Alembic migrations using `sa.text()` on SQLite, bind datetime params explicitly with `sa.bindparam(..., type_=sa.DateTime())` — never pass untyped Python datetime values.
- Don't use raw SQL to INSERT into ORM-modeled tables — bypasses Python-level defaults (`Field(default=...)`) and breaks when new NOT NULL columns are added. Use `Session(bind=conn)` + ORM objects instead.
- After merging branches with Alembic migrations, run `alembic heads` — if multiple heads exist, run `alembic merge heads -m "merge_<description>"` before committing.
- Never hold a write transaction open across slow I/O (LLM calls, network requests). Use short atomic commits and `session.no_autoflush` to prevent SELECTs from triggering implicit flushes.

## Dependencies & Background Jobs

- **feedparser** for RSS/Atom parsing. **APScheduler** for background jobs (feed refresh, scoring queue).
- `ollama.AsyncClient` is NOT an async context manager — use `client = AsyncClient(...)` directly, never `async with`.
- `httpx.Timeout` requires either a positional default or all four params (connect, read, write, pool) — use `httpx.Timeout(default, connect=override)` pattern.

## Configuration

- Config priority: env vars > `.env` file > YAML config (`CONFIG_FILE`) > defaults in `config.py`.
- Nested env vars use double-underscore notation (e.g., `OLLAMA__HOST`).
- Settings cached via `@lru_cache` — requires restart to pick up changes.

## Testing

- FastAPI `dependency_overrides` keys by function object — tests must import `get_session` from the same module as routers (`deps.py`).
- Use `test_session.expire_all()` after API writes to see fresh DB state in test assertions.
- Use `@pytest.mark.asyncio` only on `async def` test functions — not on sync functions using TestClient.
- Don't mock database calls — use real SQLite test databases via fixtures.
- Don't use `:memory:` SQLite without `StaticPool` — tables are invisible across connections without it.
- Factory fixtures (`make_feed`, `make_article`, `make_category`) go in `conftest.py` — per-file helpers only when no factory covers the need.
- Patch lifespan side-effects in `test_client` fixture — don't let TestClient hit production DB or start scheduler.
