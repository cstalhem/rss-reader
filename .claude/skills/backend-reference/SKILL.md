---
name: backend-reference
description: Backend architecture reference — router modules, scoring pipeline, article lifecycle, SQLite pragmas, config system, schema versioning, and shared deps
---

# Backend Reference

Architecture and implementation reference for the backend. For concise rules, see `.claude/rules/backend.md`.

## Code Organization

| Module | Purpose |
|--------|---------|
| `main.py` | App entry point: FastAPI creation, CORS, lifespan, router registration, health endpoint |
| `routers/` | 6 APIRouter modules: articles, feeds, categories, preferences, ollama, scoring |
| `models.py` | SQLModel table definitions (Feed, Article, Category, ArticleCategoryLink, UserPreferences) |
| `schemas.py` | Pydantic request/response models — dual schemas: `ArticleListItem` (lightweight, no content) for list endpoints, `ArticleResponse` (full) for detail |
| `deps.py` | Shared FastAPI dependencies: get_session, get_or_create_preferences, resolve_ollama_models |
| `database.py` | Engine, schema versioning (schema_version table), startup migrations |
| `scoring.py` | LLM scoring functions, pure scoring helpers (compute_composite_score, is_blocked, get_effective_weight) |
| `scoring_queue.py` | ScoringQueue class: enqueue, rescore, process_next_batch pipeline |
| `scheduler.py` | APScheduler setup: feed refresh + scoring queue processing jobs |
| `ollama_service.py` | Ollama client wrapper: health, models, pull, delete |
| `config.py` | Pydantic Settings with @lru_cache |
| `feeds.py` | Feed fetching and article saving logic |
| `prompts.py` | LLM prompt templates and response models |

## Scoring Pipeline (Two-Step)

Articles are scored in two stages using separate Ollama models (configurable independently):

1. **`categorize_article()`** -- assigns up to 4 kebab-case English categories using `categorization_model`
2. **`score_article()`** -- evaluates interest (0-10) and quality (0-10) using `scoring_model`

The scoring queue in `scoring_queue.py` processes articles via `ScoringQueue.process_next_batch()`, called every 30 seconds by the scheduler. The per-article loop uses three short atomic commits to avoid holding SQLite write locks across LLM calls:

- **Phase A**: Resolve/create categories under `session.no_autoflush`, then commit (~1ms)
- **Phase B**: Write `ArticleCategoryLink` rows + unhide mutations, then commit (~1ms)
- **Phase C**: `score_article()` LLM call (no write lock), then commit final scores (~1ms)

The session uses `expire_on_commit=False` (set in `scheduler.py`) so Category objects remain populated across intermediate commits.

## Article Lifecycle (Scoring States)

```
unscored -> queued -> scoring -> scored (or failed)
```

- Articles only appear in Unread/All views after reaching `scored` state with `composite_score != 0`
- Articles with score 0 (all categories blocked) appear only in the Blocked tab
- `database.py` resets articles stuck in `scoring_state='scoring'` back to `queued` on startup, handling cases where the process was killed mid-scoring

## Schema Versioning (Dual-Layer)

Migrations run in two layers during `create_db_and_tables()` in `database.py`:

**Layer 1 — schema_version bootstrap:** A hand-rolled `schema_version` table gates v0→v1→v2 migrations (seed default categories, add `feed_refresh_interval`). Each version check runs once, not every startup. This layer is frozen — no new versions will be added.

**Layer 2 — Alembic:** All schema changes after v2 are managed by Alembic (`_run_alembic_migrations()`). The function locates `alembic.ini` via `Path(__file__).resolve().parents[2]` (project root) and runs `alembic upgrade head`.

**Docker caveat:** The Dockerfile runtime stage must explicitly COPY `alembic.ini` and `alembic/` from the builder — if missing, `_run_alembic_migrations()` logs a warning and silently skips, leaving the database schema behind the ORM models.

## SQLite Configuration

Pragmas set on every connection via SQLAlchemy `connect` event in `database.py`:

| Pragma         | Value  | Why                                                                |
| -------------- | ------ | ------------------------------------------------------------------ |
| `journal_mode` | WAL    | Prevents "database is locked" during concurrent scoring/API access |
| `busy_timeout` | 5000ms | Wait instead of failing on lock contention                         |
| `foreign_keys` | ON     | Enforce referential integrity                                      |
| `cache_size`   | 64MB   | Larger cache for better read performance                           |

## Pydantic Settings Config Priority

Config loads in order (first match wins):

1. Environment variables
2. `.env` file
3. YAML config file (`CONFIG_FILE` env var)
4. Defaults in `config.py`

Nested env vars use double-underscore notation: `OLLAMA__HOST` maps to `settings.ollama.host`.

Settings are cached via `@lru_cache` -- requires process restart to pick up changes.
