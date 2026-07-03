# Project Research Summary

**Project:** RSS Reader v1.1 — Configuration, Feedback & Polish
**Domain:** RSS Reader Enhancement — Runtime Configuration, User Feedback, Category Organization, UI Refinement
**Researched:** 2026-02-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

This research covers v1.1 enhancements to an existing RSS reader with LLM-powered article scoring. The v1.0 foundation (feed fetching, article storage, Ollama scoring pipeline, basic reading UI) is complete and validated. v1.1 focuses on **configurability** (Ollama model selection at runtime), **feedback** (learning from user signals), **organization** (hierarchical category grouping), and **polish** (UI refinements).

**The recommended approach prioritizes simplicity over complexity:** Runtime configuration uses a two-tier pattern (static Settings for infrastructure, dynamic UserPreferences for user choices). Feedback avoids fine-tuning complexity by adjusting category weights instead of retraining models. Category grouping uses nested JSON in SQLite with explicit weight resolution rules. Only one new frontend dependency is required (dnd-kit-sortable-tree for drag-and-drop tree UI), with all other capabilities leveraging the existing validated stack.

**Key risks center on state management and integration:** Pydantic Settings with `@lru_cache` prevents runtime config updates unless explicitly cleared. SQLAlchemy doesn't detect in-place mutations to JSON columns. Feedback loops can cause scoring drift if not aggregated and bounded. Category hierarchies create confusing weight resolution without explicit rules. All risks are well-documented with clear mitigation strategies. Estimated implementation: 7-11 days across 4 phases.

## Key Findings

### Recommended Stack

The v1.1 scope requires **minimal stack additions**. Research confirms the existing stack (FastAPI, SQLModel, SQLite, Next.js, Chakra UI v3, Ollama, httpx) handles all requirements except hierarchical category drag-and-drop UI.

**No new backend dependencies required:**
- `ollama` (v0.6.1, already present) — provides `.list()` and `.show()` methods for model enumeration and details
- `httpx` (v0.28.1, already present) — used for Ollama health checks
- `sqlmodel` (v0.0.32, already present) — supports JSON columns for category groups and feedback aggregates

**One new frontend dependency:**
- `dnd-kit-sortable-tree` (latest) — hierarchical drag-and-drop for category tree UI, built on existing `@dnd-kit/core` and `@dnd-kit/sortable` dependencies, purpose-built for nested hierarchies, accessible, TypeScript-ready

**Configuration approach:** Two-tier pattern separating infrastructure config (Settings with `@lru_cache` for host, timeout, database path) from user-facing config (UserPreferences in database for model selection, feedback settings). This enables runtime updates without restart while keeping Settings immutable.

**Feedback approach:** Weight adjustment strategy, not LLM fine-tuning. Fine-tuning requires LoRA adapters, GPU resources, training infrastructure — inappropriate for single-user local app. Weight adjustment achieves similar goals (boosting preferred content, suppressing disliked content) without model surgery, applies instantly, and requires no additional compute.

### Expected Features (v1.1 Scope Only)

Research identified comprehensive feature landscape for RSS readers, but v1.1 scope has been narrowed to 4 specific features. Features deferred to v1.2 include: Real-Time Push Updates (SSE), Feed Categories/Folders, Feed Auto-Discovery.

**Must have (v1.1 in scope):**
- **Ollama Configuration UI** — connection status indicator, locally available models list, model selection for categorization and scoring, prompt visibility (transparency)
- **LLM Feedback Loop** — thumbs up/down buttons on articles, feedback aggregation by category, weight adjustment strategy, daily batch processing
- **Category Grouping** — hierarchical category organization (2-level maximum recommended), per-group default weights, per-category weight overrides, cascading weight resolution with explicit priority rules
- **UI & Theme Polish** — semantic token refinements, loading states with Skeleton components, spacing improvements for readability, smooth read/unread transitions

**Table stakes (already implemented in v1.0):**
- Feed subscription management, article list view, mark as read/unread, in-app reader, LLM scoring with Ollama, prose-style preferences, interest score display, dark/light theme toggle

**Defer (v1.2+):**
- Real-Time Push Updates via SSE, Feed Categories/Folders, Feed Auto-Discovery, OPML import/export, article search, keyboard shortcuts, starred/saved articles

### Architecture Approach

v1.1 integrates with existing v1.0 architecture via **additive changes**. The backend remains FastAPI with APScheduler background jobs for feed refresh and scoring. The frontend remains Next.js App Router with TanStack Query for server state. Three new backend modules (ollama_client.py, category_groups.py, feedback_aggregator.py) handle new capabilities without modifying existing scoring or fetching logic except for integration points.

**Major components:**

1. **Ollama Configuration Module** — wraps Ollama REST API (health check, list models, show model details), provides hybrid config loader that merges UserPreferences overrides with Settings defaults, exposes 2 new endpoints (`GET /api/ollama/models`, `GET /api/ollama/status`)

2. **Feedback System** — stores latest feedback in `Article.user_feedback` field (TEXT: "thumbs_up", "thumbs_down", "skip"), aggregates daily via APScheduler job into `UserPreferences.feedback_aggregates` JSON (category → weight delta mapping), applies feedback-adjusted weights in scoring pipeline's `compute_composite_score()`

3. **Category Grouping** — new `CategoryGroup` table with `parent_group_id`, `categories` JSON array, `default_weight` field, weight resolver with explicit priority (explicit topic_weights > group default > parent group default > "neutral"), exposes 4 CRUD endpoints

4. **Data Flow Changes** — scoring pipeline modified at 3 points: (1) load Ollama config from hybrid source, (2) merge feedback_aggregates into topic_weights before scoring, (3) resolve category weights through group hierarchy. No changes to categorize/score LLM prompts or article fetching logic.

**Integration patterns:**

- **Hybrid Configuration:** Settings provides infrastructure defaults (host, timeout, cached), UserPreferences provides runtime overrides (models, cached in DB). Scoring functions check UserPreferences first, fall back to Settings. No `@lru_cache` invalidation needed.

- **Aggregated Feedback Weights:** Daily batch job computes category-level deltas from article feedback events, requires minimum 5 signals per category, scales ratio (-1.0 to +1.0) to weight delta (-0.5 to +0.5), stores in UserPreferences, applies additively to base topic_weights.

- **Cascading Weight Resolution:** Priority-based resolver checks (1) explicit topic_weights, (2) CategoryGroup membership and default_weight, (3) parent group default_weight, (4) "neutral" fallback. Resolves ambiguity with "first match" or explicit handling for categories in multiple groups.

### Critical Pitfalls

Research identified 12 pitfalls, but only 5 are relevant to v1.1 scope (others relate to SSE, feed discovery, and features deferred to v1.2).

1. **@lru_cache Prevents Runtime Ollama Config Updates** — Settings cached forever, updating UserPreferences or YAML has no effect until restart. **Mitigation:** Don't invalidate Settings cache. Instead, use two-tier pattern: always check UserPreferences first in scoring functions, use Settings as fallback. This avoids cache invalidation complexity.

2. **Feedback Loop Causes Scoring Drift** — Catastrophic forgetting from continual learning, reward hacking, human evaluator inconsistency leads to unreliable scoring over time. **Mitigation:** Don't fine-tune the model. Use feedback for category weight adjustment (bounded 0.0-2.0), daily aggregation with minimum 5 signals per category, decay old feedback over time (weights drift toward 1.0).

3. **SQLite JSON Column Mutation Not Detected by SQLAlchemy** — In-place mutations (`dict['key'] = value`) don't mark object dirty, changes silently lost. **Mitigation:** Always use full reassignment pattern (`dict = {**dict, 'key': value}`) documented in AGENTS.md. Test persistence with fresh session query after update.

4. **Hierarchical Category Weight Resolution Confusion** — Parent/child weight interactions create ambiguous resolution (does parent override child? what about articles with multiple categories?). **Mitigation:** Define explicit priority rules (explicit > group > parent > neutral), document clearly, or keep flat structure for v1.1 (recommended). Test thoroughly with articles having mixed category memberships.

5. **Chakra UI v3 Portal Performance with Many Components** — Eager Portal mounting creates CSSStyleSheet instances for each Menu/Popover, accumulates thousands of stylesheets with SSE re-renders, causes sluggish UI. **Mitigation:** Lazy mount Portals (only when open), virtualize long lists, memoize positioning props, monitor stylesheet count in development.

## Implications for Roadmap

Based on research, suggested phase structure builds incrementally with each phase independent but providing capabilities for later phases.

### Phase 1: Ollama Configuration UI (1-2 days)

**Rationale:** Simplest integration, independent of other features, provides foundation for experimenting with feedback loop using different models. No external dependencies, well-documented Ollama API, straightforward UI.

**Delivers:**
- Ollama connection health indicator in settings
- Dropdown to select categorization model from locally available models
- Dropdown to select scoring model from locally available models
- Prompt viewer showing current prompts for transparency
- Validation that selected models exist before saving

**Stack elements:**
- `ollama` Python library (existing) — `.list()`, `.show()` methods
- `httpx` (existing) — health check endpoint
- Chakra UI `Select`, `Badge`, `Field` components (existing)
- TanStack Query for model list fetching (existing)

**Avoids pitfalls:**
- Two-tier config pattern prevents cache invalidation issues
- Model validation before save prevents "model not loaded" errors during scoring

**Research flag:** SKIP — Ollama API is well-documented, straightforward REST endpoints, no complexity.

---

### Phase 2: Category Grouping (2-3 days)

**Rationale:** Provides organizational structure needed before implementing feedback (feedback aggregates by category, grouping helps users understand feedback impact). Weight resolution logic needed by feedback system.

**Delivers:**
- CRUD UI for creating category groups
- Drag-and-drop tree interface for organizing categories into groups
- Per-group default weight settings (cascades to all categories in group)
- Per-category weight override UI (takes priority over group default)
- Weight resolution in scoring pipeline with explicit priority rules

**Stack elements:**
- `dnd-kit-sortable-tree` (NEW) — hierarchical drag-and-drop
- `CategoryGroup` SQLModel table (NEW)
- Nested JSON storage in UserPreferences (existing pattern)
- SQLite `json_tree()` function (existing)

**Architecture components:**
- `category_groups.py` module with weight resolver
- 4 CRUD endpoints for group management
- Integration with `compute_composite_score()` in scoring.py

**Avoids pitfalls:**
- Explicit weight resolution priority rules prevent confusion
- Flat structure initially recommended (can add parent_group_id later)
- Full JSON reassignment pattern prevents mutation detection issues

**Research flag:** MEDIUM — Tree UI has standard patterns via dnd-kit-sortable-tree, but weight resolution logic is custom. Needs testing with mixed category memberships.

---

### Phase 3: LLM Feedback Loop (3-4 days)

**Rationale:** Depends on category grouping for sensible weight aggregation. Most complex integration (touches scoring pipeline), benefits from having Ollama config UI available for testing with different models.

**Delivers:**
- Thumbs up/down buttons on article rows
- Visual feedback state indicator (filled icons for voted articles)
- Backend aggregation job (daily APScheduler task)
- Category weight adjustment strategy (bounded, minimum sample size)
- Integration with scoring pipeline via feedback_aggregates

**Stack elements:**
- `react-icons` (existing) — `FiThumbsUp`, `FiThumbsDown`
- Chakra UI `IconButton`, `Toast` (existing)
- TanStack Query mutations (existing)
- APScheduler (existing) — daily job for aggregation

**Architecture components:**
- `feedback_aggregator.py` module (NEW)
- `Article.user_feedback` field (NEW)
- `UserPreferences.feedback_aggregates` JSON field (NEW)
- Modified `compute_composite_score()` to merge feedback weights

**Avoids pitfalls:**
- Weight adjustment (not fine-tuning) prevents scoring drift
- Daily aggregation (not per-feedback) reduces noise
- Minimum 5 signals per category before adjustment prevents single-vote impact
- Weight bounds (0.0-2.0) prevent runaway drift
- Additive adjustment preserves explicit topic_weights

**Research flag:** HIGH — Custom aggregation strategy, no standard patterns for this specific approach. Needs thorough testing with conflicting signals (100+ feedback events) to verify stability.

---

### Phase 4: UI & Theme Polish (1-2 days)

**Rationale:** Refinement phase after functionality complete. Benefits from all features being in place to see holistic UX. No backend changes, purely frontend improvements.

**Delivers:**
- Semantic token refinements for better contrast and hierarchy
- Loading states with Skeleton components during article list loading
- Spacing adjustments for improved readability (py=3.5 px=5 instead of py=3 px=4)
- Smooth transitions on read/unread state changes
- Responsive breakpoint refinements

**Stack elements:**
- Chakra UI v3 design system (existing) — semantic tokens, Skeleton, Transition
- Emotion `keyframes` (existing) — for custom animations
- Theme system in `frontend/src/theme/` (existing)

**Avoids pitfalls:**
- Verify semantic token completeness before changes (all colorPalette tokens present)
- Test components after theme updates to catch rendering issues
- Avoid changing spatial properties (breaks layout)
- Add new tokens for new needs rather than modifying existing

**Research flag:** SKIP — Standard UI patterns, well-documented in Chakra UI v3, no novel integration.

---

### Phase Ordering Rationale

**Sequential, not parallel:** Dependencies dictate this order. Category grouping provides weight resolution for feedback. Feedback depends on having organizational structure to make aggregates meaningful. Ollama config enables experimentation during feedback testing. Polish refines complete feature set.

**Why not group Ollama config with feedback?** Ollama config is simple (1-2 days), feedback is complex (3-4 days). Separating allows early validation of config UI pattern before tackling feedback integration. Also, config UI provides immediate user value (model switching) independent of feedback.

**Why category grouping before feedback?** Weight resolution logic in grouping is needed by feedback aggregator. Users need to understand category hierarchy to interpret feedback's impact on scoring. Grouping provides UI for explicit category weight setting, which feedback complements.

**Why polish last?** Can't polish what doesn't exist. Polish phase needs complete feature set to assess holistic UX. Also serves as buffer — if earlier phases take longer, polish can be compressed or split into separate release.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Feedback Loop):** Custom aggregation strategy with no standard patterns. Needs `/gsd:research-phase` to investigate feedback weight adjustment algorithms, minimum sample size thresholds, decay functions, and stability testing approaches.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Ollama Config):** REST API wrapper, standard CRUD patterns, well-documented Ollama API.
- **Phase 4 (UI Polish):** UI refinement using existing design system capabilities, standard semantic token patterns.

**Phase with moderate complexity:**
- **Phase 2 (Category Grouping):** Tree UI is standard via dnd-kit-sortable-tree. Weight resolution is custom but straightforward (priority-based resolver). Can skip dedicated research if phase plan includes explicit resolution rules and test cases.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new dependency required (dnd-kit-sortable-tree), all others existing and validated. Ollama Python library methods verified in official GitHub repo. |
| Features | MEDIUM-HIGH | Features well-defined, but feedback aggregation strategy is custom (no standard implementation to reference). Category grouping patterns established in other apps. |
| Architecture | HIGH | Integration points clearly defined, hybrid config pattern documented in FastAPI official docs, weight resolution logic is straightforward priority-based system. |
| Pitfalls | HIGH | All relevant pitfalls well-documented with clear mitigation strategies. SQLAlchemy JSON mutation issue already documented in AGENTS.md. |

**Overall confidence:** MEDIUM-HIGH

Research is comprehensive for in-scope features. The main uncertainty is feedback loop stability (custom strategy, needs empirical validation with conflicting signals). All other areas have established patterns or official documentation.

### Gaps to Address

**Feedback aggregation parameters:** Research recommends minimum 5 signals per category and delta scaling of 0.5, but these are heuristics not empirically validated. During Phase 3 planning, consider researching:
- Optimal minimum sample size for single-user app (5? 10? 20?)
- Appropriate weight delta magnitude (0.5 too aggressive? 0.2 safer?)
- Decay function for aging feedback (linear? exponential? none?)
- Conflict resolution when feedback is evenly split (3 up, 3 down → no change? or small adjustment?)

**Mitigation:** Start with conservative values (minimum 10 signals, delta 0.2, no decay initially). Monitor in production for 2-4 weeks. Adjust based on observed scoring stability. Add telemetry to track: feedback count per category, weight drift over time, composite score distribution changes.

---

**Category hierarchy depth:** Research recommends 2-level maximum (groups → categories), but initial implementation may keep flat structure to avoid complexity. Decision point during Phase 2 planning.

**Mitigation:** Implement flat structure with explicit weight settings in v1.1. Add `parent_group_id` support in v1.2 if users request deeper hierarchy. This avoids premature complexity while keeping option open.

---

**Ollama model switching timing:** Research identifies race condition when switching models during active scoring. Recommended mitigation is pausing queue during config updates, but this adds complexity.

**Mitigation during Phase 1 planning:** Research whether scoring queue pause is necessary or if simple retry logic suffices. Ollama's model loading is fast (10-30s for 8B models), and scoring queue processes batches of 5 every 30s. Single retry with 30s backoff may be sufficient without queue pause complexity.

---

**Chakra Portal performance threshold:** Research warns about CSSStyleSheet leak with "many" components, but exact threshold unclear (50? 100? 200?).

**Mitigation:** Add development-mode stylesheet count monitoring in Phase 4. Log warning if `document.styleSheets.length > 500`. Test with 100+ feeds to establish actual threshold for this specific app.

## Sources

### Primary (HIGH confidence)
- [FastAPI Settings Management](https://fastapi.tiangolo.com/advanced/settings/) — `@lru_cache` pattern, Pydantic Settings
- [SQLite JSON Functions](https://sqlite.org/json1.html) — `json_tree()`, nested JSON querying
- [dnd-kit Sortable Preset](https://docs.dndkit.com/presets/sortable) — foundation for dnd-kit-sortable-tree
- [Ollama Python Library](https://github.com/ollama/ollama-python) — `.list()`, `.show()` API methods
- [Ollama API Documentation](https://docs.ollama.com/api/tags) — REST endpoints, model listing
- [SQLAlchemy JSON Type](https://docs.sqlalchemy.org/en/20/core/type_basics.html#sqlalchemy.types.JSON) — mutation detection behavior

### Secondary (MEDIUM confidence)
- [dnd-kit-sortable-tree GitHub](https://github.com/Shaddix/dnd-kit-sortable-tree) — hierarchical drag-and-drop library
- [SQLite JSON Querying Tutorial](https://dadroit.com/blog/json-querying/) — nested structure patterns
- [RLHF Overview (Wikipedia)](https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback) — feedback loop concepts
- [LLM Fine-Tuning Guide](https://www.turing.com/resources/finetuning-large-language-models) — why PEFT/LoRA not suitable
- [Meta Reels Feedback System](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/) — real-world feedback integration
- [Continual Learning with RL for LLMs](https://cameronrwolfe.substack.com/p/rl-continual-learning) — catastrophic forgetting patterns
- [Chakra UI v3 Performance Issues](https://github.com/chakra-ui/chakra-ui/discussions/8706) — CSSStyleSheet leak patterns

### Tertiary (LOW confidence)
- [Ollama Health Check Discussion](https://github.com/ollama/ollama/issues/1378) — community patterns for health endpoints
- [Thumbs Up/Down Survey Patterns](https://www.zonkafeedback.com/blog/collecting-feedback-with-thumbs-up-thumbs-down-survey) — UX best practices
- [Top Drag-and-Drop Libraries 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — library comparison
- [Hierarchical UI Patterns](https://ui-patterns.com/patterns/categorization) — tree navigation best practices

---
*Research completed: 2026-02-14*
*Ready for roadmap: yes*
