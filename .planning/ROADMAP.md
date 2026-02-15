# Roadmap: RSS Reader

## Milestones

- ✅ **v1.0 MVP** - Phases 1-5 (shipped 2026-02-14)
- 🚧 **v1.1 Configuration, Feedback & Polish** - Phases 6-9 (in progress)

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
**Plans**: TBD

Plans:
- [ ] 07-01: TBD during planning
- [ ] 07-02: TBD during planning

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
**Plans**: TBD

Plans:
- [ ] 08-01: TBD during planning
- [ ] 08-02: TBD during planning

#### Phase 9: LLM Feedback Loop
**Goal**: User feedback improves scoring over time via category weight adjustments and interest suggestions
**Depends on**: Phase 8 (category weight resolution needed)
**Requirements**: FEEDBACK-01, FEEDBACK-02, FEEDBACK-03, FEEDBACK-04
**Success Criteria** (what must be TRUE):
  1. User can give thumbs up/down feedback on any article from article list
  2. User can see feedback aggregated by category in settings (thumbs up vs down counts)
  3. System suggests category weight adjustments based on feedback patterns with minimum sample size
  4. System suggests interest text rewrites based on patterns in thumbed up/down articles
**Plans**: TBD

Plans:
- [ ] 09-01: TBD during planning
- [ ] 09-02: TBD during planning
- [ ] 09-03: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | 4/4 | Complete | 2026-02-05 |
| 2. Article Reading UI | v1.0 | 5/5 | Complete | 2026-02-07 |
| 3. Feed Management | v1.0 | 5/5 | Complete | 2026-02-10 |
| 4. LLM Content Curation | v1.0 | 3/3 | Complete | 2026-02-12 |
| 5. Interest-Driven UI | v1.0 | 2/2 | Complete | 2026-02-14 |
| 6. UI & Theme Polish | v1.1 | 3/3 | Complete | 2026-02-15 |
| 7. Ollama Configuration UI | v1.1 | 0/TBD | Not started | - |
| 8. Category Grouping | v1.1 | 0/TBD | Not started | - |
| 9. LLM Feedback Loop | v1.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-14*
*Last updated: 2026-02-15 after Phase 6 execution*
