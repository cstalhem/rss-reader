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
| `schemas.py` | Pydantic request/response models for all endpoints |
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

The scoring queue in `scoring_queue.py` processes articles via `ScoringQueue.process_next_batch()`, called every 30 seconds by the scheduler.

## Article Lifecycle (Scoring States)

```
unscored -> queued -> scoring -> scored (or failed)
```

- Articles only appear in Unread/All views after reaching `scored` state with `composite_score != 0`
- Articles with score 0 (all categories blocked) appear only in the Blocked tab
- `database.py` resets articles stuck in `scoring_state='scoring'` back to `queued` on startup, handling cases where the process was killed mid-scoring

## Schema Versioning

`database.py` uses a `schema_version` table with a `CURRENT_SCHEMA_VERSION` constant. Version-gated migrations run on startup -- each version check runs once, not every startup.

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
