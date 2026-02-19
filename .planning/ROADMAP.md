# Roadmap: RSS Reader

## Milestones

- ✅ **v1.0 MVP** - Phases 1-5 (shipped 2026-02-14)
- 🚧 **v1.1 Configuration, Feedback & Polish** - Phases 6-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) - SHIPPED 2026-02-14</summary>

### Phase 1: Infrastructure
**Goal**: Docker-based development and production environment with FastAPI backend and SQLite database
**Plans**: 4 plans

Plans:
- [x] 01-01: Backend project initialization
- [x] 01-02: Docker setup for local development
- [x] 01-03: Feed and Article data models
- [x] 01-04: Production Docker Compose configuration

### Phase 2: Article Reading UI
**Goal**: Web interface for reading articles with Next.js and Chakra UI v3
**Plans**: 5 plans

Plans:
- [x] 02-01: Next.js app initialization
- [x] 02-02: Article list component
- [x] 02-03: Article reader drawer
- [x] 02-04: Theme system (dark/light with orange accent)
- [x] 02-05: State management with TanStack Query

### Phase 3: Feed Management
**Goal**: Complete feed lifecycle from subscription to content updates
**Plans**: 5 plans

Plans:
- [x] 03-01: Feed fetching with feedparser
- [x] 03-02: Scheduled refresh with APScheduler
- [x] 03-03: Feed CRUD API endpoints
- [x] 03-04: Feed management UI components
- [x] 03-05: Drag-and-drop feed reordering

### Phase 4: LLM Content Curation
**Goal**: Ollama-powered article scoring with categorization and interest matching
**Plans**: 3 plans

Plans:
- [x] 04-01: Ollama integration and two-step scoring pipeline
- [x] 04-02: Category-based weighting system
- [x] 04-03: Settings UI for interests and topic weights

### Phase 5: Interest-Driven UI
**Goal**: Surface high-value articles through filtering and adaptive polling
**Plans**: 2 plans

Plans:
- [x] 05-01: Score badges, sort controls, and filter tabs
- [x] 05-02: Adaptive polling and real-time scoring feedback

</details>

### v1.1 Configuration, Feedback & Polish (In Progress)

**Milestone Goal:** Make the LLM curation loop configurable and improvable from the UI, add hierarchical category management, and polish the overall experience.

#### Phase 6: UI & Theme Polish
**Goal**: Refined visual design, improved UX consistency, and settings page reorganization
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06
**Success Criteria** (what must be TRUE):
  1. Dark mode color scheme is softer with reduced saturation and contrast
  2. Article list and settings pages show loading skeletons during data fetching
  3. API failures show error toasts and settings saves show success toasts
  4. Settings page is reorganized with clear sections or tabs (Feeds, Interests, Ollama, Feedback)
  5. Reader drawer typography and spacing create a comfortable reading experience
  6. Empty states provide helpful prompts (no articles yet, no feedback yet, no categories configured)
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md -- Warm dark mode token foundation and Fira Code font loading
- [x] 06-02-PLAN.md -- Reader typography, skeletons, empty states, and toast polish
- [x] 06-03-PLAN.md -- Settings page restructure with sidebar navigation and sections

#### Phase 7: Ollama Configuration UI
**Goal**: Runtime Ollama configuration without YAML/env changes
**Depends on**: Phase 6 (settings page reorganized)
**Requirements**: OLLAMA-01, OLLAMA-02, OLLAMA-03, OLLAMA-04, OLLAMA-05
**Success Criteria** (what must be TRUE):
  1. User can see Ollama connection health (connected/disconnected badge with latency)
  2. User can select categorization and scoring models from dropdown of locally available models
  3. User can trigger model downloads from within settings UI with progress indication
  4. User can view current system prompts used for categorization and scoring in read-only text areas
  5. User can trigger batch re-scoring of recent articles after changing models or config
**Plans**: 6 plans

Plans:
- [x] 07-01-PLAN.md -- Backend: Ollama service layer, API endpoints, DB migration, two-tier scoring config
- [x] 07-02-PLAN.md -- Frontend: Health badge, model selector, system prompts, re-score button
- [x] 07-03-PLAN.md -- Frontend: Model download/delete management with streaming progress
- [x] 07-04-PLAN.md -- Gap closure: Backend error handling for model pulls and unconditional re-scoring
- [x] 07-05-PLAN.md -- Gap closure: Progress bar persistence and layout consistency
- [x] 07-06-PLAN.md -- Gap closure: UI refinements (Chakra Select, empty states, panel sections)

#### Phase 8: Category Grouping
**Goal**: Hierarchical category organization with cascading weights
**Depends on**: Phase 7
**Requirements**: CATGRP-01, CATGRP-02, CATGRP-03, CATGRP-04, CATGRP-05
**Success Criteria** (what must be TRUE):
  1. User can create named category groups (e.g., "Programming", "Vehicles") via settings UI
  2. User can drag existing categories into groups using tree interface
  3. User can set a weight on a group that applies to all child categories by default
  4. User can override the group weight for individual categories within a group
  5. Scoring pipeline resolves effective weight using priority: explicit override > group default > neutral (1.0)
**Plans**: 11 plans

Plans:
- [x] 08-01-PLAN.md -- Backend: data model, migration, weight resolution, and API endpoints
- [x] 08-02-PLAN.md -- Frontend: types, API client, useCategories hook, settings restructure
- [x] 08-03-PLAN.md -- Frontend: CategoriesSection with accordion groups, weight presets, ungrouped list
- [x] 08-04-PLAN.md -- Frontend: cross-container drag-and-drop, group create/rename/delete
- [x] 08-05-PLAN.md -- Frontend: three-tier notification badges, new/returned category chips
- [x] 08-06-PLAN.md -- Gap closure: scrollbar layout shift fix and Interests section panel restyle
- [x] 08-07-PLAN.md -- Gap closure: attached weight presets, size matching, hover highlights, muted inherited styling
- [x] 08-08-PLAN.md -- Gap closure: hover-reveal rename/delete, drag placeholder, badge dismiss icon
- [ ] 08-09-PLAN.md -- Gap closure: standardize subheader styling across all settings sections
- [ ] 08-10-PLAN.md -- Gap closure: expandable badge X icon with spacing and divider
- [ ] 08-11-PLAN.md -- Gap closure: correct drag placeholder positioning and Safari performance

### Phase 08.1: Categories Settings UI Redesign (INSERTED)

**Goal:** Redesign categories settings panel from accordion-based groups to tree view with parent-child category model
**Depends on:** Phase 8
**Requirements:** CATGRP-01, CATGRP-02, CATGRP-03, CATGRP-04, CATGRP-05
**Plans:** 10/10 plans complete

Plans:
- [x] 08.1-01-PLAN.md -- Backend: data model migration, seeded hierarchy, weight resolution, API updates
- [x] 08.1-02-PLAN.md -- Frontend: types, API, hook, tree view rendering with weight display
- [x] 08.1-03-PLAN.md -- Frontend: DnD integration, search filtering, category CRUD
- [x] 08.1-04-PLAN.md -- Frontend: weight preset strip, mobile swipe, visual verification
- [x] 08.1-05-PLAN.md -- Gap closure R1: Backend API fixes (create discovery, rename persistence, URL routing, split behavior)
- [x] 08.1-06-PLAN.md -- Gap closure R1: DnD performance optimization, ungroup zone, sensors fix
- [x] 08.1-07-PLAN.md -- Gap closure R1: Optimistic weight updates with toast feedback
- [x] 08.1-08-PLAN.md -- Gap closure R1: Visual polish (connector lines, weight icons, row layouts, animations)
- [ ] 08.1-09-PLAN.md -- Gap closure R2: Visual fixes (connector line gaps, action icon hover, weight button sizing)
- [ ] 08.1-10-PLAN.md -- Gap closure R2: Functional fixes (duplicate category validation/toasts, optimistic update latency)

### Phase 08.2: Category Data Model Refactor

**Goal:** Migrate categories from JSON blobs to a proper Category table with ArticleCategoryLink junction table, enabling clean relational operations for grouping, renaming, splitting, and Phase 10 feedback aggregation
**Depends on:** Phase 08.1
**Deferred from:** 08.1-UAT-r2.md gap #10 (parent split vs delete -- root cause: JSON blob surgery too fragile)
**Requirements:** CATGRP-01, CATGRP-02, CATGRP-03, CATGRP-04, CATGRP-05
**Success Criteria** (what must be TRUE):
  1. Category table exists with columns: id, name, parent_id, weight, is_hidden, is_manually_created, is_seen
  2. ArticleCategoryLink junction table replaces Article.categories JSON column
  3. All category API endpoints use relational queries (no JSON blob manipulation)
  4. Scoring pipeline writes to junction table via get_or_create pattern
  5. Frontend API contract unchanged or cleanly migrated (no regressions)
  6. Data migration preserves all existing categories, weights, groupings, and article associations
  7. Split group = `UPDATE SET parent_id = NULL` (one operation, no data loss)
**Plans**: 7 plans

Plans:
- [x] 08.2-01-PLAN.md -- Backend: Category and ArticleCategoryLink models, data migration with backup
- [x] 08.2-02-PLAN.md -- Backend: Scoring pipeline and prompts update for display names and relational writes
- [x] 08.2-03-PLAN.md -- Backend: Category API endpoints rewrite and article response enrichment
- [x] 08.2-04-PLAN.md -- Frontend: TypeScript types, API client, and hooks for new category model
- [x] 08.2-05-PLAN.md -- Frontend: Component updates for display names and rich category objects
- [ ] 08.2-06-PLAN.md -- Gap closure: Settings UI optimistic updates, button visibility, badge dismiss
- [ ] 08.2-07-PLAN.md -- Gap closure: DnD ungroup fix and article reader weight change fix

### Phase 08.3: Category Group Management Redesign

**Goal:** Replace drag-and-drop category grouping with checkbox multi-select + action bar paradigm, collapsible tree, context menus, and mobile card layout
**Depends on:** Phase 08.2
**Requirements:** CATGRP-02, CATGRP-03
**Deferred from:** 08.1-UAT-r2.md gaps #5 (DnD performance) and #6 (ungroup via DnD)
**Success Criteria** (what must be TRUE):
  1. User can group/ungroup categories with a smooth, reliable interaction (no DnD bugs)
  2. Grouping interaction works on both desktop and mobile
  3. Visual feedback is clear during group management actions
**Plans**: 6 plans

Plans:
- [x] 08.3-01-PLAN.md -- Backend: fix hide/unhide semantics, batch endpoints, ungroup parent, LLM prompt update
- [x] 08.3-02-PLAN.md -- Frontend: strip DnD, collapsible parent rows, checkbox multi-select
- [x] 08.3-03-PLAN.md -- Frontend: action bar, context menus, batch API client and hook integration
- [x] 08.3-04-PLAN.md -- Frontend: Move to Group dialog, delete/ungroup confirmation dialogs
- [x] 08.3-05-PLAN.md -- Frontend: hidden categories section, mobile card layout
- [x] 08.3-06-PLAN.md -- Gap closure: sticky action bar, chevron rotation, weight strip labels, dialog child count

#### Phase 9: Frontend Codebase Evaluation & Simplification
**Goal**: Evaluate and simplify the frontend codebase — hooks, components, state patterns, and theme usage — addressing technical debt from rapid feature development while retaining all functionality
**Scope**: Frontend only (`frontend/src/`). Backend is out of scope.
**Depends on**: Phase 08.3 (all category management work complete)
**Origin**: Pending todo #2 (codebase evaluation and simplification phase)
**Success Criteria** (what must be TRUE):
  1. Mutation error handling is consistent — no mutations silently swallow errors; centralized via `MutationCache` callbacks where appropriate
  2. Hook return interfaces expose useful mutation state (`.isPending`, `.mutateAsync()`) instead of hiding it behind thin wrapper functions
  3. Query keys are centralized in a key factory — no inline string literals scattered across hooks
  4. Dead code from DnD removal, data model migration, and abandoned components is cleaned up
  5. Duplicated UI patterns (rename logic, confirmation dialogs) are extracted into shared hooks/components
  6. `useEffect` usage follows React best practices — no effects that should be derived state, event handlers, or `key`-prop resets
  7. Chakra UI semantic tokens used consistently — no hardcoded color values in components; consistent Tooltip/Portal patterns
  8. Hard-coded magic numbers (polling intervals, layout dimensions, thresholds) are extracted into named constants
  9. No functional regressions
**Specific items to evaluate**:
  _TanStack Query / Hooks:_
  - `useCategories.ts`: 11 mutations with thin `.mutate()` wrappers that hide `isPending`/`mutateAsync`. Expose mutation objects for callers that need state
  - `useCategories.ts`: near-identical `onSuccess`/`onError` boilerplate across mutations. Centralize via `MutationCache` + `meta` tags
  - `useFeedMutations.ts`, `usePreferences.ts`: no error handling at all — mutations fail silently
  - Inline query key strings repeated across all hooks (e.g., `["categories"]` appears ~12 times in `useCategories` alone). Extract to `queryKeys.ts` factory
  - Redundant invalidation calls: `["categories"]` prefix already covers `["categories", "new-count"]`
  _Dead code / stale files:_
  - `CategoryRow.tsx`, `WeightPresets.tsx`, `SwipeableRow.tsx` — dead files from previous phases
  - Leftover `@dnd-kit` / `@hello-pangea/dnd` dependencies and imports
  - `savedConfig` alias in `useOllamaConfig.ts`; dead filter branch in `ArticleList.tsx` L168
  _Duplicated patterns:_
  - Rename state/UI logic copy-pasted across `CategoryParentRow`, `CategoryChildRow`, `CategoryUngroupedRow`, and `FeedRow` — extract `useRenameState` hook or `RenameInput` component
  - Two inline ungroup confirmation dialogs in `CategoriesSection.tsx` — extract to shared `ConfirmDialog`
  - Two near-identical model row render blocks in `ModelManagement.tsx`
  _React patterns:_
  - `WeightPresetStrip.tsx`: `useState` + `useEffect` sync from prop — evaluate if derived state or controlled pattern is cleaner
  - `ArticleReader.tsx`: `useEffect` resetting `optimisticWeights` on `article?.id` change — could use `key` prop instead
  - `InterestsSection.tsx`: `useEffect` syncing server state into local form state — risk of overwriting user edits on refetch
  _Chakra UI / Theme:_
  - Hardcoded `oklch` in `ArticleReader.tsx` code block styling — should be a semantic token
  - Raw palette colors: `green.600` in `AddFeedDialog`, `orange.400` in `ModelSelector` — should use semantic tokens
  - `var(--chakra-colors-*)` strings on react-icons in 8+ components — establish pattern (wrap in `Box` with `color` prop)
  - Inconsistent Tooltip usage: `ScoreBadge` uses raw `Tooltip.Root` (no Portal), `WeightPresetStrip` uses `@/components/ui/tooltip` wrapper
  - `FeedRow.tsx`: raw HTML `<input>` with inline `style={{}}` — only instance in codebase; should use Chakra `Input`
  _Organization:_
  - `ScoringStatus` and `DownloadStatus` types defined in `api.ts` instead of `types.ts`
  - `parseSortOption` runtime function in `types.ts` — should be in `utils.ts`
  - `API_BASE_URL` duplicated in `api.ts` and `useModelPull.ts`
  _Magic numbers:_
  - Polling intervals: 12000, 10000, 5000, 2500, 30000, 3000, 1000 scattered across hooks with no named constants
  - Layout dimensions: `"64px"` header height, `"48px"`/`"240px"` sidebar widths repeated in `Sidebar.tsx` and `AppShell.tsx`
  - Thresholds: `composite_score >= 15` (high-score accent), `.slice(0, 3)` (max tags), `50` (page size) — unnamed
**Plans**: 4 plans

Plans:
- [ ] 09-01-PLAN.md -- Infrastructure: query key factory, MutationCache, constants, file organization
- [ ] 09-02-PLAN.md -- Hook refactors: query keys, mutation exposure, error handling, useRenameState, magic numbers
- [ ] 09-03-PLAN.md -- Component updates: consumer migration, ConfirmDialog, semantic tokens, Tooltip/Portal/color fixes
- [ ] 09-04-PLAN.md -- Dead code removal, useEffect fixes, performance sweep, final verification

### Phase 09.1: Backend Codebase Evaluation & Simplification (INSERTED)

**Goal:** Evaluate and simplify the backend codebase — models, API endpoints, scoring pipeline, configuration, and database patterns — addressing technical debt from rapid feature development while retaining all functionality
**Scope:** Backend only (`backend/src/backend/`). Frontend is out of scope.
**Depends on:** Phase 9 (frontend evaluation complete)
**Origin:** Companion to Phase 9 (frontend evaluation); same purpose applied to backend
**Scope decisions:**
  - Sync SQLAlchemy kept as deliberate simplicity tradeoff for single-user app (async migration deferred to pending todo)
  - `main.py` split into APIRouter modules (best practice at 1,426 lines / 6 resource domains)
  - Basic pure-function scoring tests included
**Success Criteria** (what must be TRUE):
  1. Ollama `AsyncClient` instances are properly closed after use (no fd leak); scoring calls have a configurable timeout (no indefinite hangs)
  2. Dead code removed — migration functions, dead endpoints, dead branches, old weight aliases, unused constants
  3. Error handling consistent — `create_feed` doesn't swallow `HTTPException`; config parse failures logged; scoring retries scoped to transient errors; all list endpoints declare `response_model`
  4. N+1 queries in `list_feeds`, `get_scoring_status`, and `get_active_categories` replaced with single queries; `mark_feed_read` uses bulk UPDATE; `scoring_state` and `composite_score` columns indexed
  5. `main.py` split into APIRouter modules (articles, feeds, categories, preferences, ollama, scoring); circular imports resolved; `_get_or_create_preferences` and Ollama model selection logic deduplicated into shared helpers
  6. Type safety improved — `settings` parameters typed; `sort_by`/`order` use `Literal` types; `rescore_mode` uses `Literal`; `unread_count` only counts scored non-blocked articles (matching frontend visibility)
  7. Async correctness — functions that don't `await` are not declared `async`; scheduler session creation uses `Session(engine)` directly; `expire_on_commit = False` has explanatory comment
  8. Magic numbers (batch size, scoring interval, Ollama timeout) extracted into named constants
  9. `compute_composite_score`, `is_blocked`, and `get_or_create_category` have basic unit tests
  10. No functional regressions
**Specific items to evaluate**:
  _Resource lifecycle:_
  - `scoring.py`: `AsyncClient` created per call without closing (lines 121-124, 186-189) — use `async with`
  - `ollama_service.py`: same pattern in `list_models`, `pull_model_stream`, `delete_model` (lines 59-61, 103, 170-171)
  - `scoring.py`: `timeout=None` on all Ollama clients — no protection against hung LLM calls
  _Dead code (~350 lines):_
  - `database.py`: `_migrate_articles_scoring_columns`, `_migrate_ollama_config_columns`, `_migrate_json_to_relational`, `_drop_old_json_columns`, `_seed_categories_from_hierarchy`, `_backup_database` — completed migrations, permanent startup overhead
  - `main.py`: `POST /api/feeds/refresh`, `POST /api/scoring/rescore` — no frontend callers
  - `main.py`: `if rescore_mode:` guard always true (line 1380) — dead branch
  - `scoring.py`: old weight name aliases in `compute_composite_score` (lines 258-263) — migration already remapped
  - `prompts.py`: `DEFAULT_CATEGORIES` — defined but never imported
  - `models.py`: `model_config = {"arbitrary_types_allowed": True}` on Article — no non-standard types
  _Error handling:_
  - `main.py`: broad `except Exception` in `create_feed` swallows `HTTPException` (line 443)
  - `config.py`: silent config parse failure — no log output on YAML errors (lines 123-125)
  - `scoring.py`: `retry_if_exception_type(Exception)` retries `ValidationError` 3x pointlessly (lines 85-89, 153-157)
  - `main.py`: `list_articles` missing `response_model=list[ArticleResponse]` (line 243); `update_ollama_config` returns untyped dict
  _Query efficiency:_
  - `main.py`: N+1 in `list_feeds` — separate COUNT per feed (lines 386-405)
  - `main.py`: N+1 in `get_scoring_status` — 5 separate COUNTs instead of GROUP BY (lines 1209-1224)
  - `scoring.py`: N+1 in `get_active_categories` — lazy `.parent` access fires SELECT per child (lines 320-333)
  - `main.py`: `mark_feed_read` materializes all articles to count them (lines 574-586)
  - `models.py`: `scoring_state` and `composite_score` not indexed — most-filtered columns
  _Code organization:_
  - `main.py` is 1,426 lines with 6 resource domains — split into APIRouter modules
  - Deferred imports in 7+ places to work around circular deps (`scheduler.py` ↔ `feeds.py` ↔ `main.py`)
  - `_get_or_create_preferences` duplicated in 3 places (main.py, scoring_queue.py, update_ollama_config)
  - Ollama model selection logic (`if use_separate_models`) duplicated in 3 places
  - Pydantic request/response models (159 lines) all in `main.py` — move with routes during split
  _Type safety:_
  - `scoring.py`: `settings` parameter untyped in `categorize_article` and `score_article`
  - `main.py`: `sort_by`/`order` accept any string — silently returns unsorted on invalid input
  - `models.py`: `rescore_mode` is stringly-typed (`"full"`, `"score_only"`, None)
  - `scoring.py`: `_scoring_activity` dict untyped (line 28)
  - `main.py`: `unread_count` includes unscored articles — inconsistent with frontend article visibility
  _Async correctness:_
  - `scoring.py`: `get_active_categories` declared `async` with no `await` (line 308)
  - `scoring_queue.py`: `enqueue_articles` and `enqueue_recent_for_rescoring` declared `async` with no `await`
  - `scheduler.py`: `next(get_session())` bypasses generator cleanup on exception (lines 24, 47)
  - `scheduler.py`: `expire_on_commit = False` set without comment (line 48)
  _Magic numbers:_
  - `scheduler.py`: batch size `5` and scoring interval `30` seconds hardcoded
  - `scoring.py`: `timeout=None` — should be named constant with reasonable default
**Deferred (out of scope):**
  - Async SQLAlchemy migration (add to pending todos — correct but high-effort, low-impact for single-user)
  - Excluding `content` field from article list responses (changes API contract, requires frontend changes)
  - Feed deduplication by GUID (requires schema change)
  - `feedparser.parse()` blocking event loop (ties into broader async migration)
**Plans**: TBD

Plans:
- [ ] 09.1-01: TBD during planning
- [ ] 09.1-02: TBD during planning

#### Phase 10: LLM Feedback Loop
**Goal**: User feedback improves scoring over time via category weight adjustments and interest suggestions
**Depends on**: Phase 9.1 (clean codebase foundation — both frontend and backend)
**Requirements**: FEEDBACK-01, FEEDBACK-02, FEEDBACK-03, FEEDBACK-04
**Success Criteria** (what must be TRUE):
  1. User can give thumbs up/down feedback on any article from article list
  2. User can see feedback aggregated by category in settings (thumbs up vs down counts)
  3. System suggests category weight adjustments based on feedback patterns with minimum sample size
  4. System suggests interest text rewrites based on patterns in thumbed up/down articles
**Plans**: TBD

Plans:
- [ ] 10-01: TBD during planning
- [ ] 10-02: TBD during planning
- [ ] 10-03: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 9.1 -> 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | 4/4 | Complete | 2026-02-05 |
| 2. Article Reading UI | v1.0 | 5/5 | Complete | 2026-02-07 |
| 3. Feed Management | v1.0 | 5/5 | Complete | 2026-02-10 |
| 4. LLM Content Curation | v1.0 | 3/3 | Complete | 2026-02-12 |
| 5. Interest-Driven UI | v1.0 | 2/2 | Complete | 2026-02-14 |
| 6. UI & Theme Polish | v1.1 | 3/3 | Complete | 2026-02-15 |
| 7. Ollama Configuration UI | v1.1 | 6/6 | Complete | 2026-02-15 |
| 8. Category Grouping | v1.1 | 8/11 | Superseded by 08.1+ | - |
| 08.1. Categories UI Redesign | v1.1 | 10/10 | Complete | 2026-02-17 |
| 08.2. Category Data Model Refactor | v1.1 | 7/7 | Complete | 2026-02-18 |
| 08.3. Group Management Redesign | v1.1 | 6/6 | Complete | 2026-02-19 |
| 9. Frontend Codebase Evaluation & Simplification | v1.1 | 0/4 | Not started | - |
| 9.1. Backend Codebase Evaluation & Simplification | v1.1 | 0/TBD | Not started | - |
| 10. LLM Feedback Loop | v1.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-19 -- Phase 08.3 closed (all 6 plans complete)*
