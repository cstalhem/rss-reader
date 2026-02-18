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

### 🚧 v1.1 Configuration, Feedback & Polish (In Progress)

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
**Deferred from:** 08.1-UAT-r2.md gap #10 (parent split vs delete — root cause: JSON blob surgery too fragile)
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
**Plans**: 5 plans

Plans:
- [ ] 08.3-01-PLAN.md -- Backend: fix hide/unhide semantics, batch endpoints, ungroup parent, LLM prompt update
- [ ] 08.3-02-PLAN.md -- Frontend: strip DnD, collapsible parent rows, checkbox multi-select
- [ ] 08.3-03-PLAN.md -- Frontend: action bar, context menus, batch API client and hook integration
- [ ] 08.3-04-PLAN.md -- Frontend: Move to Group dialog, delete/ungroup confirmation dialogs
- [ ] 08.3-05-PLAN.md -- Frontend: hidden categories section, mobile card layout

#### Phase 9: Codebase Evaluation & Simplification
**Goal**: Thorough evaluation of codebase, architecture, and data models to surface simplifications and address technical debt while retaining all functionality
**Depends on**: Phase 08.3 (all category management work complete)
**Origin**: Pending todo #2 (codebase evaluation and simplification phase)
**Success Criteria** (what must be TRUE):
  1. Hard-coded values, duplicated logic, and inconsistencies identified and addressed
  2. Hook return interfaces reviewed — remove unnecessary wrapper indirection (e.g., useCategories exposes thin `.mutate()` wrappers that hide useful mutation state like `.mutateAsync()`, `.isPending`)
  3. Component boundaries validated — shared components with behavioral `type` props evaluated for splitting
  4. Dead code from DnD removal and data model migration cleaned up
  5. No functional regressions
**Specific items to evaluate**:
  - `useCategories.ts` wrapper functions: most are zero-value indirection over `.mutate()`. Evaluate exposing mutation objects directly for callers that need `.mutateAsync()`, `.isPending`, etc. (discovered during Phase 08.3 Plan 04 review)
  - Repetitive mutation boilerplate in `useCategories.ts` (7 mutations with near-identical invalidation + toast patterns)
  - Leftover `@dnd-kit` / `@hello-pangea/dnd` dependencies and imports after Phase 08.3 DnD removal
  - Consistency of error handling and toast patterns across all hooks
**Plans**: TBD

Plans:
- [ ] 09-01: TBD during planning
- [ ] 09-02: TBD during planning

#### Phase 10: LLM Feedback Loop
**Goal**: User feedback improves scoring over time via category weight adjustments and interest suggestions
**Depends on**: Phase 9 (clean codebase foundation)
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
Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | 4/4 | Complete | 2026-02-05 |
| 2. Article Reading UI | v1.0 | 5/5 | Complete | 2026-02-07 |
| 3. Feed Management | v1.0 | 5/5 | Complete | 2026-02-10 |
| 4. LLM Content Curation | v1.0 | 3/3 | Complete | 2026-02-12 |
| 5. Interest-Driven UI | v1.0 | 2/2 | Complete | 2026-02-14 |
| 6. UI & Theme Polish | v1.1 | 3/3 | Complete | 2026-02-15 |
| 7. Ollama Configuration UI | v1.1 | 6/6 | Complete | 2026-02-15 |
| 8. Category Grouping | v1.1 | 8/11 | In progress | - |
| 08.1. Categories UI Redesign | v1.1 | Complete    | 2026-02-17 | 2026-02-17 |
| 08.2. Category Data Model Refactor | v1.1 | Complete    | 2026-02-17 | - |
| 08.3. Group Management Redesign | 1/5 | In Progress|  | - |
| 9. Codebase Evaluation & Simplification | v1.1 | 0/TBD | Not started | - |
| 10. LLM Feedback Loop | v1.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-17 -- Phase 08.2 planned (5 plans in 3 waves)*
