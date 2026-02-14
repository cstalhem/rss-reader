# Architecture Integration: v1.1 Features

**Domain:** RSS Reader v1.1 — Configuration UI, Feedback Loop, Category Grouping, UI Polish
**Researched:** 2026-02-14
**Confidence:** HIGH

## Context

This architecture document focuses on **integration points** for v1.1 features with the existing v1.0 system. Based on PROJECT.md, v1.1 scope includes:
- Ollama Configuration UI (runtime model selection)
- UI & Theme Polish (design refinements)
- LLM Feedback Loop (user feedback collection + scoring integration)
- Category Grouping (hierarchical category organization with cascading weights)

**DEFERRED to v1.2:** Real-Time Push (SSE), Feed Categories/Folders, Feed Auto-Discovery

**Existing v1.0 architecture:**
- Backend: FastAPI + SQLModel + SQLite with APScheduler background jobs
- Frontend: Next.js App Router + Chakra UI v3 + TanStack Query
- Config: Pydantic Settings with `@lru_cache` singleton
- Scoring: Two-step pipeline (categorize → score) in 30-second batches
- Data layer: TanStack Query polls backend every 30s (adaptive during scoring)

---

## System Architecture: v1.1 Additions

```
┌────────────────────── FRONTEND ──────────────────────┐
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │    Existing Components (no structural       │    │
│  │    changes)                                  │    │
│  │  ArticleList, ArticleReader, FeedRow, etc   │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │    NEW: Settings Page Sections               │    │
│  │  - OllamaConfigSection (new component)       │    │
│  │  - CategoryGroupsSection (new component)     │    │
│  │  - PreferencesSection (existing, no change)  │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │    NEW: Feedback Components                  │    │
│  │  - FeedbackButtons (inline in ArticleRow)    │    │
│  │  - FeedbackIndicator (show collected         │    │
│  │    feedback state)                           │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │    TanStack Query (no changes)               │    │
│  │  + NEW queries: ollama config, feedback,     │    │
│  │    category groups                           │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
└───────────────────────┬───────────────────────────────┘
                        │
                        │ REST API (JSON)
                        │
┌───────────────────────┴───────────────────────────────┐
│                    BACKEND                             │
│                                                        │
│  ┌─────────────────────────────────────────────┐     │
│  │    NEW: Ollama Management Endpoints          │     │
│  │  GET /api/ollama/status                      │     │
│  │  GET /api/ollama/models                      │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  ┌─────────────────────────────────────────────┐     │
│  │    NEW: Feedback Endpoints                   │     │
│  │  POST /api/articles/{id}/feedback            │     │
│  │  GET /api/feedback/summary (aggregates)      │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  ┌─────────────────────────────────────────────┐     │
│  │    NEW: Category Groups Endpoints            │     │
│  │  GET /api/category-groups                    │     │
│  │  POST /api/category-groups                   │     │
│  │  PATCH /api/category-groups/{id}             │     │
│  │  DELETE /api/category-groups/{id}            │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  ┌─────────────────────────────────────────────┐     │
│  │    MODIFIED: Preferences Endpoint            │     │
│  │  PUT /api/preferences                        │     │
│  │    + ollama_config JSON field                │     │
│  │    + feedback_settings JSON field            │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  ┌─────────────────────────────────────────────┐     │
│  │    MODIFIED: Scoring Pipeline                │     │
│  │  - scoring.py: compute_composite_score()     │     │
│  │    uses group weight resolver                │     │
│  │  - scoring.py: load runtime Ollama config    │     │
│  │  - scoring_queue.py: apply feedback weights  │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  ┌─────────────────────────────────────────────┐     │
│  │    NEW: Database Models                      │     │
│  │  + CategoryGroup table                       │     │
│  │  + Article.user_feedback field               │     │
│  │  + UserPreferences.ollama_config field       │     │
│  │  + UserPreferences.feedback_aggregates       │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### Backend: New vs Modified

| Component | Type | Purpose | Integration Point |
|-----------|------|---------|-------------------|
| `ollama_client.py` | NEW | Wrapper for Ollama REST API (status, models list) | Uses httpx, called from endpoints |
| `category_groups.py` | NEW | Category hierarchy CRUD + weight resolution | Called from scoring.py, endpoints |
| `feedback_aggregator.py` | NEW | Aggregate user feedback into category adjustments | APScheduler daily job, updates UserPreferences |
| `models.py::CategoryGroup` | NEW | Hierarchy model with parent_id, default_weight | Standard SQLModel table |
| `models.py::Article` | MODIFIED | Add `user_feedback` TEXT field | Migration via database.py |
| `models.py::UserPreferences` | MODIFIED | Add `ollama_config`, `feedback_aggregates` JSON fields | Migration via database.py |
| `scoring.py::compute_composite_score()` | MODIFIED | Call category_groups weight resolver | Replaces direct topic_weights lookup |
| `scoring.py::categorize_article()` | MODIFIED | Load model from UserPreferences or Settings | Hybrid config pattern |
| `scoring.py::score_article()` | MODIFIED | Load model from UserPreferences or Settings | Hybrid config pattern |
| `scoring_queue.py::process_next_batch()` | MODIFIED | Merge feedback_aggregates into topic_weights | Before calling compute_composite_score |
| `main.py` | MODIFIED | Add 3 new endpoint groups (12 total endpoints) | Standard FastAPI routing |
| `database.py` | MODIFIED | Add migration function `_migrate_v11_fields()` | Startup checks pattern |

### Frontend: New Components

| Component | Location | Purpose | Dependencies |
|-----------|----------|---------|--------------|
| `OllamaConfigSection.tsx` | `components/settings/` | Model picker, connection status, prompt viewer | TanStack Query |
| `CategoryGroupsSection.tsx` | `components/settings/` | CRUD UI for category hierarchy | TanStack Query, Chakra Tree (if exists) or custom |
| `FeedbackButtons.tsx` | `components/article/` | Thumbs up/down inline in rows | TanStack Query mutations |
| `FeedbackIndicator.tsx` | `components/article/` | Show current feedback state (visual) | Props only, no queries |

### Frontend: Modified Components

| Component | What Changes | Why |
|-----------|--------------|-----|
| `ArticleRow.tsx` | Add FeedbackButtons (conditional, hide if already read) | Inline feedback UI |
| `SettingsPage.tsx` | Add OllamaConfigSection, CategoryGroupsSection | New settings surfaces |
| `types.ts` | Add Article.user_feedback, UserPreferences fields | Type safety |
| `api.ts` | Add ollama, feedback, category-groups client functions | API client completeness |

---

## Data Model Extensions

### New Tables

```sql
-- Category hierarchy (replaces flat category string list)
CREATE TABLE category_groups (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,                      -- "Technology", "News", etc.
    parent_group_id INTEGER REFERENCES category_groups(id),  -- NULL for root groups
    default_weight TEXT DEFAULT 'neutral',    -- inherited by children
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Why not a separate junction table?** Categories are strings (not entities), stored in `Article.categories` JSON array. CategoryGroup defines **groups of category strings**, not a many-to-many relationship. A group like "Technology" contains `categories: ["ai-ml", "programming", "cybersecurity"]` as a JSON field.

**Revised CategoryGroup model:**
```python
class CategoryGroup(SQLModel, table=True):
    __tablename__ = "category_groups"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)  # "Technology", "News"
    parent_group_id: int | None = Field(default=None, foreign_key="category_groups.id")
    categories: list[str] | None = Field(default=None, sa_column=Column(JSON))  # ["ai-ml", "programming"]
    default_weight: str = Field(default="neutral")  # "blocked", "low", "neutral", "medium", "high"
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now)
```

### Modified Tables

```sql
-- Articles table
ALTER TABLE articles ADD COLUMN user_feedback TEXT;  -- "thumbs_up", "thumbs_down", "skip", NULL

-- UserPreferences table
ALTER TABLE user_preferences ADD COLUMN ollama_config TEXT;  -- JSON: {"categorization_model": "...", "scoring_model": "..."}
ALTER TABLE user_preferences ADD COLUMN feedback_aggregates TEXT;  -- JSON: {"ai-ml": 0.15, "politics": -0.3}
```

**Migration strategy:** Add `database.py::_migrate_v11_fields()` following existing pattern in `_migrate_articles_scoring_columns()`.

---

## Data Flow Changes

### Flow 1: Ollama Configuration (Runtime Changes)

```
[Settings Page → OllamaConfigSection]
    ↓ user queries available models
[GET /api/ollama/models] → httpx → Ollama /api/tags → [{name, size, modified_at}, ...]
    ↓ renders model picker
[User selects "qwen3:8b" for categorization]
    ↓
[PUT /api/preferences] with ollama_config: {"categorization_model": "qwen3:8b", ...}
    ↓
UserPreferences.ollama_config updated (JSON column reassignment)
    ↓
[Next scoring cycle]
scoring.py::categorize_article() loads config:
    prefs.ollama_config.get("categorization_model") or settings.ollama.categorization_model
    ↓
Uses user-selected model without restart
```

**Key insight:** Don't invalidate `@lru_cache` on Settings. Instead, always check UserPreferences first in scoring functions. Settings provides **defaults**, UserPreferences provides **overrides**.

**Code pattern:**
```python
def get_ollama_config(session: Session) -> dict:
    """Load runtime Ollama config with fallback to Settings."""
    prefs = session.exec(select(UserPreferences)).first()
    settings = get_settings()  # Cached, no invalidation needed

    return {
        "categorization_model": (
            prefs.ollama_config.get("categorization_model")
            if prefs and prefs.ollama_config
            else settings.ollama.categorization_model
        ),
        "scoring_model": (
            prefs.ollama_config.get("scoring_model")
            if prefs and prefs.ollama_config
            else settings.ollama.scoring_model
        ),
        "host": settings.ollama.host,  # Always from Settings (infrastructure)
        "timeout": settings.ollama.timeout,  # Always from Settings
    }
```

### Flow 2: Feedback Collection → Aggregation → Scoring

```
[ArticleRow] user clicks thumbs_up
    ↓
[POST /api/articles/{id}/feedback] {feedback_type: "thumbs_up"}
    ↓
Article.user_feedback = "thumbs_up"
session.commit()
    ↓ (no immediate effect on scoring)
[Daily APScheduler job: aggregate_feedback()]
    ↓
feedback_aggregator.py:
  - Query all articles with user_feedback != NULL
  - Group by category, count thumbs_up vs thumbs_down
  - Compute weight deltas: (up - down) / total * 0.5 (scaled to -0.5..+0.5)
  - Require minimum 5 feedback events per category
    ↓
Update UserPreferences.feedback_aggregates: {"ai-ml": +0.2, "politics": -0.3}
session.commit()
    ↓
[Next scoring cycle]
scoring_queue.py::process_next_batch():
  - Load topic_weights and feedback_aggregates
  - Merge: adjusted_weight = base_weight + feedback_delta
  - Pass adjusted weights to compute_composite_score()
    ↓
Scores reflect learned preferences
```

**Why daily aggregation, not per-feedback?**
- Single feedback event = noise (user might misclick)
- Aggregation smooths over multiple signals
- Avoids expensive re-scoring (would block pipeline)
- Batch job is cheap (simple COUNT queries)

**Why store aggregates, not raw feedback events?**
- Single-user app: don't need time-series analysis
- Aggregates are sufficient for weight adjustment
- Keeps UserPreferences as single source of derived config
- Can always add time-series table later if needed

### Flow 3: Category Grouping → Cascading Weight Resolution

```
[Settings Page → CategoryGroupsSection]
    ↓ user creates group "Technology" with default_weight="high"
[POST /api/category-groups] {name: "Technology", default_weight: "high", categories: ["ai-ml", "programming"]}
    ↓
CategoryGroup table row inserted
    ↓
[During scoring]
scoring.py::compute_composite_score(categories=["ai-ml"], topic_weights={...})
    ↓
For each category: resolve_category_weight("ai-ml", topic_weights, session)
    ↓
category_groups.py::resolve_category_weight():
  1. Check topic_weights["ai-ml"] → "neutral" (explicit user setting)
  2. Check CategoryGroup membership:
     - "ai-ml" is in "Technology" group
     - "Technology" has default_weight="high"
  3. Resolution priority: explicit topic_weight > group default > "neutral"
  4. Return "neutral" (explicit wins over group)
    ↓
Use resolved weight in composite score calculation
```

**Weight resolution priority:**
1. **Explicit topic_weights** (user set via category chip in UI) — HIGHEST
2. **CategoryGroup.default_weight** (cascades to all categories in group)
3. **Parent group default_weight** (if group has parent_group_id)
4. **"neutral"** (fallback)

**Why explicit topic_weights beat group defaults?** User explicitly setting a category weight in the UI is a stronger signal than group membership. Groups provide **convenient defaults**, per-category weights provide **fine-grained control**.

---

## Integration Patterns

### Pattern 1: Hybrid Configuration (Static + Dynamic)

**Problem:** Pydantic Settings with `@lru_cache` are immutable at runtime. Ollama model selection needs to be user-configurable without restart.

**Solution:** Two-tier config system:
- **Static (Settings):** Infrastructure config (host, timeout, database path) — env/YAML, cached, rarely changes
- **Dynamic (UserPreferences):** User-facing config (model selection, feedback settings) — database, hot-reloadable

**Implementation:**
```python
# scoring.py
async def categorize_article(...):
    config = get_ollama_config(session)  # Hybrid loader
    client = AsyncClient(host=config["host"], timeout=config["timeout"])
    response = await client.chat(model=config["categorization_model"], ...)
```

**Trade-offs:**
- Pro: User can change models from UI without touching YAML or restarting
- Pro: Config survives container restarts (persistent SQLite)
- Con: Two sources of truth (need explicit merge logic)
- Con: Must remember to check UserPreferences in scoring functions

### Pattern 2: Aggregated Feedback Weights

**Problem:** Single thumbs up/down events are noisy. Need stable, gradual weight adjustments.

**Solution:** Daily batch aggregation with minimum sample size threshold.

**Implementation:**
```python
def aggregate_feedback_weights(session: Session) -> dict[str, float]:
    """
    Compute category weight deltas from user feedback.

    Returns: {"category": delta} where delta is -0.5 to +0.5
    """
    articles = session.exec(
        select(Article).where(Article.user_feedback.is_not(None))
    ).all()

    category_feedback = {}  # {"ai-ml": {"up": 5, "down": 1}, ...}

    for article in articles:
        if not article.categories:
            continue
        for cat in article.categories:
            if cat not in category_feedback:
                category_feedback[cat] = {"up": 0, "down": 0}

            if article.user_feedback == "thumbs_up":
                category_feedback[cat]["up"] += 1
            elif article.user_feedback == "thumbs_down":
                category_feedback[cat]["down"] += 1

    # Convert to deltas
    deltas = {}
    for cat, counts in category_feedback.items():
        total = counts["up"] + counts["down"]
        if total < 5:  # Minimum sample size
            continue

        ratio = (counts["up"] - counts["down"]) / total  # -1.0 to +1.0
        deltas[cat] = ratio * 0.5  # Scale to weight delta

    return deltas
```

**Why this works:**
- Requires 5+ feedback events before affecting scores (stability)
- Ratio is bounded (-1.0 to +1.0), scales to reasonable weight delta (-0.5 to +0.5)
- Additive adjustment: `base_weight + delta` (doesn't overwrite explicit settings)

### Pattern 3: Cascading Weight Resolution

**Problem:** Users want both global defaults (groups) and fine-grained overrides (per-category).

**Solution:** Priority-based resolver with explicit priority order.

**Implementation:**
```python
def resolve_category_weight(
    category: str,
    topic_weights: dict[str, str],
    session: Session,
) -> str:
    """
    Resolve category weight with priority:
    1. Explicit topic_weights (user set in UI)
    2. CategoryGroup.default_weight (group membership)
    3. Parent group default_weight (inheritance)
    4. "neutral" (fallback)
    """
    # Priority 1: Explicit setting
    if category in topic_weights:
        return topic_weights[category]

    # Priority 2: Group membership
    groups = session.exec(
        select(CategoryGroup).where(
            func.json_contains(CategoryGroup.categories, f'"{category}"')
        )
    ).all()

    if groups:
        # Use first group's default_weight (could add conflict resolution)
        return groups[0].default_weight

    # Priority 4: Fallback
    return "neutral"
```

**Trade-offs:**
- Pro: Intuitive mental model (specific beats general)
- Pro: Flexible (users can organize categories into groups without losing per-category control)
- Con: Multiple groups containing same category = ambiguity (resolved by "first match" or explicit handling)

---

## Build Order & Dependencies

### Dependency Graph

```
[Ollama Config UI] (independent)
    ↓ (provides: runtime model selection for feedback experiments)
[Category Grouping] (independent)
    ↓ (provides: weight resolution for feedback)
[LLM Feedback Loop] (depends on: Category Grouping for weight cascade)
    ↓ (provides: learned preferences for UI polish)
[UI Polish] (depends on: all features complete)
```

### Recommended Build Order

**Phase 1: Ollama Configuration (1-2 days)**
- Backend: Add ollama_client.py, 2 endpoints, UserPreferences field
- Frontend: OllamaConfigSection component, TanStack Query hooks
- Confidence: HIGH (simple REST API wrapper)
- Risk: LOW (independent, small scope)

**Phase 2: Category Grouping (2-3 days)**
- Backend: CategoryGroup model, CRUD endpoints, weight resolver
- Frontend: CategoryGroupsSection with tree UI
- Confidence: HIGH (standard CRUD + weight logic)
- Risk: MEDIUM (tree UI complexity, but can use flat list initially)

**Phase 3: LLM Feedback Loop (3-4 days)**
- Backend: Add Article.user_feedback, feedback endpoint, aggregator job, scoring integration
- Frontend: FeedbackButtons, FeedbackIndicator components
- Confidence: MEDIUM (aggregation logic is custom)
- Risk: MEDIUM (scoring integration must not break existing behavior)

**Phase 4: UI & Theme Polish (1-2 days)**
- Backend: None
- Frontend: Spacing, loading states, error handling improvements
- Confidence: HIGH (standard UI patterns)
- Risk: LOW (refinement, not functionality)

**Total estimate:** 7-11 days

---

## Migration Strategy

### Database Migrations

Add to `database.py`:

```python
def _migrate_v11_fields():
    """Add v1.1 fields to existing tables."""
    inspector = inspect(engine)

    # Articles table
    if "articles" in inspector.get_table_names():
        articles_cols = {col["name"] for col in inspector.get_columns("articles")}
        if "user_feedback" not in articles_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE articles ADD COLUMN user_feedback TEXT"))
                logger.info("Added articles.user_feedback column")

    # UserPreferences table
    if "user_preferences" in inspector.get_table_names():
        prefs_cols = {col["name"] for col in inspector.get_columns("user_preferences")}
        if "ollama_config" not in prefs_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE user_preferences ADD COLUMN ollama_config TEXT"))
                conn.execute(text("ALTER TABLE user_preferences ADD COLUMN feedback_aggregates TEXT"))
                logger.info("Added UserPreferences v1.1 columns")

    # CategoryGroup table
    if "category_groups" not in inspector.get_table_names():
        CategoryGroup.__table__.create(engine)
        logger.info("Created category_groups table")

# Call from create_db_and_tables()
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    if inspect(engine).has_table("articles"):
        _migrate_articles_scoring_columns()  # Existing v1.0
        _recover_stuck_scoring()  # Existing v1.0
        _migrate_v11_fields()  # NEW
    # ...
```

### Backwards Compatibility

**Ollama config:** If UserPreferences.ollama_config is NULL, fall back to Settings defaults. No breaking change.

**Feedback:** Article.user_feedback NULL means no feedback collected. Aggregator handles gracefully.

**Category groups:** If no groups exist, weight resolution falls back to topic_weights directly. No breaking change.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Invalidating Settings Cache

**What people do:** Add `invalidate_settings_cache()` and call it after updating UserPreferences.

**Why it's wrong:**
- Settings is for infrastructure config (env/YAML), not user config
- Invalidating cache breaks separation of concerns
- Forces Settings to reload from env/YAML (won't see database changes)

**Do this instead:** Keep Settings cached. Always check UserPreferences first in scoring functions. Settings provides defaults, UserPreferences provides overrides.

### Anti-Pattern 2: Separate Feedback Table

**What people do:** Create `article_feedback` table with time-series rows (one per feedback event).

**Why it's wrong for single-user app:**
- Time-series analysis is overkill (won't run ML on 100 feedback events)
- Aggregation is trivial (just COUNT thumbs up/down)
- Adds JOIN complexity to every feedback query
- Can always add later if analytics needed

**Do this instead:** Store latest feedback in Article.user_feedback (one field). Store aggregates in UserPreferences.feedback_aggregates (one JSON field).

### Anti-Pattern 3: Immediate Re-Scoring on Feedback

**What people do:** Re-score article immediately when user clicks thumbs up/down.

**Why it's wrong:**
- Single feedback event = noise (user might change mind)
- Re-scoring is expensive (LLM call, blocks queue)
- No benefit (user already saw the article)
- Wastes LLM cycles on already-read articles

**Do this instead:** Batch aggregation (daily). Only affects **future** articles. If user wants immediate effect, they can adjust category weight explicitly in settings.

### Anti-Pattern 4: Complex Category Hierarchy

**What people do:** Support unlimited nesting depth, multiple parents, circular references.

**Why it's wrong:**
- Single-user app: won't have 1000 categories needing deep hierarchy
- Adds complexity (tree traversal, cycle detection, performance)
- UI nightmare (displaying 5-level trees)

**Do this instead:** Flat groups or single-level hierarchy (parent_group_id, no grandparents). Sufficient for organizing 20-50 categories.

---

## Endpoint Summary

### New Endpoints (12 total)

**Ollama Management (2):**
- `GET /api/ollama/status` → {status: "healthy"|"unavailable", latency_ms: number}
- `GET /api/ollama/models` → [{name, size, modified_at}, ...]

**Feedback (2):**
- `POST /api/articles/{id}/feedback` → {user_feedback: "thumbs_up"|"thumbs_down"|"skip"}
- `GET /api/feedback/summary` → {aggregates: {"ai-ml": 0.2, ...}, last_updated: datetime}

**Category Groups (4):**
- `GET /api/category-groups` → [CategoryGroup, ...]
- `POST /api/category-groups` → CategoryGroup
- `PATCH /api/category-groups/{id}` → CategoryGroup
- `DELETE /api/category-groups/{id}` → {ok: true}

**Modified Endpoints:**
- `PUT /api/preferences` — now accepts `ollama_config`, `feedback_settings` in request body

---

## Sources

**Configuration Patterns:**
- FastAPI Settings Management: https://fastapi.tiangolo.com/advanced/settings/
- Pydantic Settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings/

**Feedback Systems:**
- Meta Reels Feedback (2026): https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/
- Implicit Feedback in RecSys: https://milvus.io/ai-quick-reference/what-is-implicit-feedback-in-recommender-systems

**Ollama API:**
- Ollama API Reference: https://github.com/ollama/ollama/blob/main/docs/api.md
- Ollama Model Management (2026): https://oneuptime.com/blog/post/2026-02-02-ollama-model-management/view

**SQLAlchemy Patterns:**
- SQLModel Documentation: https://sqlmodel.tiangolo.com/
- SQLAlchemy JSON Columns: https://docs.sqlalchemy.org/en/20/core/type_basics.html#sqlalchemy.types.JSON

---

*Architecture research for: RSS Reader v1.1 Milestone (Configuration, Feedback, Category Grouping, UI Polish)*
*Researched: 2026-02-14*
