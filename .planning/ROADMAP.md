# Roadmap: RSS Reader

## Overview

This roadmap takes the RSS Reader from backend completion to a production-ready application with LLM-powered content curation. Phase 1 establishes production infrastructure, Phases 2-3 deliver the core reading experience, and Phases 4-5 integrate intelligent content scoring that separates signal from noise. Each phase builds on previous work to deliver a personal RSS reader that surfaces interesting articles while hiding the firehose.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Production Infrastructure** - Docker deployment with persistent storage
- [x] **Phase 2: Article Reading UI** - Browse and read articles with theme support
- [x] **Phase 3: Feed Management** - Add and remove feed subscriptions
- [x] **Phase 4: LLM Content Curation** - Automatic interest scoring with Ollama
- [ ] **Phase 5: Interest-Driven UI** - Visual presentation by relevance

## Phase Details

### Phase 1: Production Infrastructure
**Goal**: Application runs in production-ready Docker environment with data persistence
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, BACK-01
**Success Criteria** (what must be TRUE):
  1. Backend and frontend services start via `docker-compose up` and auto-restart on failure
  2. SQLite database persists across container restarts (data survives `docker-compose down && docker-compose up`)
  3. Health checks confirm services are ready before accepting traffic
  4. SQLite WAL mode prevents "database is locked" errors during concurrent access
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Backend infrastructure (config, WAL mode, health endpoint, Dockerfile)
- [x] 01-02-PLAN.md — Frontend Dockerfile with standalone output
- [x] 01-03-PLAN.md — Docker Compose orchestration with health checks

### Phase 2: Article Reading UI
**Goal**: Users can browse and read articles in a clean interface with theme control
**Depends on**: Phase 1
**Requirements**: BRWS-01, BRWS-02, BRWS-03, BRWS-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. User can view article list with preview cards showing title, snippet, source, and date
  2. User can mark articles as read/unread from the article list view
  3. User can open an article to read full content in the in-app reader
  4. User can click link in reader view to open original article URL in new tab
  5. User can toggle between dark and light themes with preference persisting across sessions
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Chakra UI setup, custom theme (dark default, orange accent), app shell layout (Wave 1)
- [x] 02-02-PLAN.md — Backend read-status filter, frontend data layer with TanStack Query (Wave 1)
- [x] 02-03-PLAN.md — Article list with rows, read/unread state, filtering, load-more (Wave 2)
- [x] 02-04-PLAN.md — Article reader drawer with auto-mark-as-read, prev/next navigation (Wave 2)

### Phase 3: Feed Management
**Goal**: Users can manage their feed subscriptions through the UI
**Depends on**: Phase 2
**Requirements**: FEED-01, FEED-02
**Success Criteria** (what must be TRUE):
  1. User can add a new RSS feed by entering its URL and see articles from that feed appear
  2. User can remove an existing feed subscription and see its articles disappear from the list
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Backend feed CRUD endpoints (model updates, API, cascade delete, unread counts)
- [x] 03-02-PLAN.md — Frontend data layer, sidebar with feed list, mobile drawer, add feed dialog
- [x] 03-03-PLAN.md — Feed row interactions (drag-reorder, hover/swipe actions, delete, rename, mark-all-read)
- [x] 03-04-PLAN.md — Human verification checkpoint for complete feed management flow

### Phase 4: LLM Content Curation
**Goal**: Articles are automatically scored by local LLM based on user interests
**Depends on**: Phase 3
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-05
**Success Criteria** (what must be TRUE):
  1. Ollama service runs and scores new articles after feed refresh completes
  2. User can write prose-style preferences describing their interests in natural language
  3. System applies keyword filters before LLM scoring to reduce processing load
  4. Articles are auto-categorized by topic (tags visible in article metadata)
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — Backend data models, preferences/categories API, Ollama Docker service (Wave 1)
- [x] 04-02-PLAN.md — LLM scoring engine: prompts, two-step pipeline, queue, scheduler (Wave 2)
- [x] 04-03-PLAN.md — Settings page UI with preferences editor and topic weights (Wave 2)
- [x] 04-04-PLAN.md — Article UI: tag chips, scoring state indicators, quick-block/boost (Wave 3)
- [x] 04-05-PLAN.md — Human verification checkpoint for complete LLM curation flow (Wave 4)

### Phase 5: Interest-Driven UI
**Goal**: Articles are visually presented by relevance based on LLM scores
**Depends on**: Phase 4
**Requirements**: BRWS-05, LLM-04
**Success Criteria** (what must be TRUE):
  1. User can see interest score indicator on each article card (visual badge or color coding)
  2. Article list is sorted by interest score with high-interest articles appearing first
  3. User can filter or re-sort articles by different criteria (newest, highest score, category)
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Production Infrastructure | 3/3 | ✓ Complete | 2026-02-05 |
| 2. Article Reading UI | 4/4 | ✓ Complete | 2026-02-07 |
| 3. Feed Management | 4/4 | ✓ Complete | 2026-02-10 |
| 4. LLM Content Curation | 5/5 | ✓ Complete | 2026-02-13 |
| 5. Interest-Driven UI | 0/TBD | Not started | - |
