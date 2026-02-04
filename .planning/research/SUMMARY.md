# Project Research Summary

**Project:** Personal RSS Reader with LLM-Powered Curation
**Domain:** RSS Feed Reader / Content Aggregator with Local AI Integration
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

This is a personal RSS reader combining traditional feed aggregation with local LLM-powered content curation. The recommended approach is a decoupled architecture: Next.js 16 frontend with Chakra UI v3 consuming a FastAPI backend (already built) that orchestrates RSS feed fetching, SQLite storage, and Ollama LLM scoring. The core differentiator is privacy-first LLM curation using prose-style preferences instead of complex filter rules or cloud-based black-box algorithms.

The stack is modern and well-documented: Next.js 16 (stable Turbopack, App Router), Chakra UI v3 (first-class Next.js support), TanStack Query v5 (server state), Zustand (client state), and Ollama JavaScript SDK for local LLM integration. All components are production-ready with active maintenance and strong documentation. The backend (FastAPI + SQLModel + SQLite + APScheduler) is already complete through Phase 2, providing a solid foundation.

The primary risk is SQLite write concurrency in production—mitigated by enabling WAL mode and proper busy timeout configuration. Secondary risks include RSS feed parsing fragility (10% of feeds are malformed XML), Ollama model quality degradation with aggressive quantization, and Next.js + Chakra UI hydration errors if SSR isn't configured correctly. All of these have well-documented prevention strategies and should be addressed in their respective phases.

## Key Findings

### Recommended Stack

The stack leverages 2026 best practices with emphasis on local-first architecture and developer experience. Next.js 16 brings stable Turbopack (2-5x faster builds) and improved caching with the `use cache` directive. Chakra UI v3 provides a mature component library with built-in dark/light theming that matches project requirements. TanStack Query v5 handles server state with 40-70% faster initial loads compared to SWR. The Ollama JavaScript SDK enables local LLM inference without cloud costs or privacy concerns.

**Core technologies:**
- **Next.js 16**: React framework with App Router and Server Components — industry standard in 2026, stable Turbopack, first-class TypeScript support
- **Chakra UI v3**: Component library with theming — native Next.js App Router support, built-in dark/light mode, minimal configuration overhead
- **TanStack Query v5**: Server state management — superior caching and optimistic updates, excellent RSC integration, strong TypeScript support
- **Ollama (JavaScript SDK)**: Local LLM client — official library with full feature support, works in Node.js and browser, streaming responses
- **FastAPI + SQLModel**: Backend framework (already built) — async-first Python API with SQLAlchemy ORM, strong type safety with Pydantic
- **SQLite with WAL mode**: Embedded database — zero-config persistence, handles 100K+ articles, sufficient for single-user deployment
- **Docker Compose**: Multi-service orchestration — simpler than Kubernetes for home server deployment, named volumes for persistence

### Expected Features

Research identified three tiers of features: table stakes (users assume they exist), differentiators (competitive advantage), and anti-features (commonly requested but problematic).

**Must have (table stakes):**
- Feed subscription management (add/remove feeds, OPML import/export)
- Article list with metadata (title, source, date, preview, read/unread status)
- Mark as read/unread (track consumption, persist across sessions)
- Clean reading view (extract main content, remove clutter, readable typography)
- Dark/light theme toggle (expected in 2026, already implemented)
- Basic keyboard shortcuts (j/k navigation, mark read, star — speed is core value)

**Should have (competitive advantage):**
- **LLM scoring for interest** (core differentiator: surface signal, hide noise using local Ollama)
- **Prose-style preferences** (natural language input: "show me X, not Y" instead of complex filter rules)
- **Multi-stage filtering** (keyword filters first, then LLM scoring to reduce inference costs)
- **Interest score display** (visual hierarchy: high-interest articles stand out via color, position, badges)
- **Training feedback loop** (mark "more/less like this" to improve LLM scoring over time)
- **Interest categorization** (auto-tag articles by topic: tech, business, science)

**Defer (v2+):**
- Serendipity scoring (find interesting outliers, requires baseline scoring first)
- Cross-device sync (massive complexity for solo dev, not critical for personal tool)
- Mobile native apps (web UI works on mobile browser for now)
- Advanced search filters (basic search sufficient initially)
- Offline reading (always online during use, not a commute scenario)

### Architecture Approach

The architecture follows an API-first separation pattern with three tiers: frontend (Next.js), backend (FastAPI), and data (SQLite). The backend is already functional with feed fetching, article storage, and scheduled refresh via APScheduler. The frontend will use Server Components by default for fast initial loads, with Client Components for interactivity (Chakra UI requires client rendering). LLM scoring happens in batch after feed refresh, not on-demand during rendering, to avoid UI blocking.

**Major components:**
1. **Next.js Frontend** (port 3210) — UI rendering with Server Components by default, Client Components for Chakra UI and interactivity, TanStack Query for API calls
2. **FastAPI Backend** (port 8912) — REST API, feed fetching with feedparser, scheduled refresh via APScheduler (30-min intervals), LLM orchestration (Milestone 3)
3. **SQLite Database** — Persistent storage for feeds, articles, LLM scores; WAL mode enabled for concurrent writes; named Docker volume for durability
4. **Ollama Service** (port 11434, Milestone 3) — Local LLM inference running outside Docker for M3 performance, batch scoring API called from backend

**Key patterns:**
- **Layered monolith** (backend): Routes → services → data access, APScheduler in same process (simpler than message queue for single-user)
- **Server Component + Client Island** (frontend): Server Components fetch initial data via REST, Client Components handle interactivity and mutations
- **Batch LLM scoring** (Milestone 3): Score articles after fetch in background, store results in DB, avoid scoring on page load (1-3 sec latency would destroy UX)
- **Docker multi-service** (deployment): Named volumes for persistence, healthchecks with `depends_on: service_healthy`, `restart: unless-stopped` for auto-recovery

### Critical Pitfalls

Research identified five critical pitfalls with high impact and clear prevention strategies:

1. **SQLite write concurrency bottleneck** — Database-level locks cause "database is locked" errors when feed refresh, LLM scoring, and user actions compete. Prevention: Enable WAL mode (`PRAGMA journal_mode=WAL`) and set high busy timeout (`PRAGMA busy_timeout=5000`) during database initialization. Address in Phase M1 before production deployment.

2. **RSS feed parsing fragility** — 10% of RSS feeds are malformed XML (whitespace before `<?xml`, encoding issues, string concatenation). A single broken feed can crash entire refresh job. Prevention: Use lenient parser (feedparser already in use), wrap each feed in try/except for error isolation, track per-feed errors in database, implement exponential backoff for repeated failures. Address in Phase M1 (MVP) with feed health tracking in Phase M2.

3. **Docker volume data loss on redeployment** — Anonymous volumes or missing volume declarations cause database and Ollama model loss during `docker-compose down`. Prevention: Use named volumes (`rss_data`, `ollama_models`) in production compose file, document backup strategy, test restore procedure. Address in Phase M1 (Docker setup) before deployment.

4. **Ollama model quantization quality loss** — Default quantized models (Q4, Q5) sacrifice LLM scoring accuracy for compatibility. Results in inconsistent interest ratings, missed context, hallucinated categories. Prevention: Start with Q6/Q8 quantization (8GB+ VRAM), create model evaluation framework with sample articles, document minimum model size (7B parameters), monitor hallucinations (invalid JSON or schema violations). Address in Phase M3 (LLM Scoring) during Ollama integration.

5. **Next.js + Chakra UI hydration errors** — Server-rendered styles don't match client DOM, causing "Hydration failed" errors, FOUC (flash of unstyled content), broken dark mode persistence. Prevention: Mark all Chakra components with `'use client'`, inject `<ColorModeScript />` in root layout, configure Emotion cache properly, test SSR explicitly with `npm run build && npm start`. Address in Phase M1 (MVP frontend) before building UI components.

## Implications for Roadmap

Based on research, the roadmap should follow a three-milestone structure aligned with the backend's existing progress (Phases 1-2 complete). The frontend needs to be built (Milestone 1), enhanced with feed management UI (Milestone 2), then integrated with LLM scoring (Milestone 3).

### Phase M1: Frontend MVP (Docker + Basic Reading UI)

**Rationale:** Backend API is complete with feed fetching and article storage. Priority is getting a usable UI deployed in production to validate the core reading experience. This phase establishes the foundation (Next.js + Chakra UI + Docker) that subsequent phases build upon. Docker deployment must be production-ready from the start to avoid redeployment data loss.

**Delivers:**
- Next.js 16 frontend scaffolding with Chakra UI v3 provider
- Article list view (Server Component fetching `/api/articles`, Client Component cards)
- Article detail/reader view (Server Component fetching single article, Client Component for actions)
- Mark as read/unread functionality (optimistic updates with TanStack Query)
- Dark/light theme toggle with persistence
- Docker Compose configuration with backend + frontend services
- Production-ready volume configuration (named volumes, healthchecks, restart policies)
- SQLite WAL mode and busy timeout configuration

**Addresses features:**
- Article list with metadata (table stakes)
- Clean reading view (table stakes)
- Mark as read/unread (table stakes)
- Dark/light theme (table stakes)

**Avoids pitfalls:**
- SQLite write concurrency (enable WAL mode and busy timeout in DB initialization)
- Docker volume data loss (named volumes, documented backup/restore)
- Chakra UI hydration errors (proper SSR setup from start: `'use client'` directives, ColorModeScript)
- RSS parsing fragility (per-feed error isolation in backend, expose feed health in UI)

**Research flag:** Standard patterns (Next.js + Chakra UI, Docker Compose) — well-documented, skip phase-specific research.

### Phase M2: Feed Management UI

**Rationale:** Users need to add/remove feeds and organize them before scaling beyond the test feeds. This phase completes the basic RSS reader functionality (feed CRUD, organization). OPML import/export enables migration from existing readers, critical for adoption.

**Delivers:**
- Feed management page (`app/feeds/page.tsx`)
- Add feed form (URL validation, test fetch before adding)
- Delete feed with confirmation
- Feed organization (folders/categories)
- OPML import/export functionality
- Feed health display (last successful fetch, error count, manual refresh)

**Addresses features:**
- Feed subscription management (table stakes)
- Feed organization (table stakes)
- OPML import/export (table stakes)

**Avoids pitfalls:**
- RSS parsing fragility (feed health tracking, manual test button for debugging broken feeds)
- Security: SSRF attacks (validate feed URLs, block private IPs like 10.x, 192.168.x)

**Research flag:** Standard CRUD patterns — skip research unless OPML parsing proves complex (unlikely, standard format).

### Phase M3: LLM Scoring Integration

**Rationale:** Core differentiator that sets this reader apart from traditional RSS tools. Requires Ollama service, batch scoring pipeline, and prose preferences UI. This is the riskiest phase (LLM quality, latency, integration complexity) and benefits most from careful implementation.

**Delivers:**
- Ollama Docker service in `docker-compose.yml` (or native on M3 host)
- Backend `scoring.py` module with batch scoring logic
- Integration in `refresh_feed()` to score new articles
- Database schema update (add `interest_score`, `score_category`, `score_reason` columns)
- Settings page for prose-style preferences (`app/settings/page.tsx`)
- Article list sorting/filtering by LLM score
- Visual interest indicators (color coding, badges, score display)
- Score rationale display ("Matched: machine learning, python")

**Addresses features:**
- LLM scoring for interest (core differentiator)
- Prose-style preferences (differentiator)
- Interest score display (differentiator)
- Smart article previews (differentiator)

**Avoids pitfalls:**
- Ollama model quality loss (use Q6/Q8 quantization, evaluate with sample articles, document minimum 7B parameters)
- LLM scoring latency (batch scoring after refresh, not on page load; async pipeline with results stored in DB)
- Performance trap: scoring on every render (pre-score during ingestion, cache results, display articles immediately)

**Research flag:** Needs research for Ollama integration patterns — LLM scoring prompts, JSON response parsing, error handling, batch processing optimization. Consider `/gsd:research-phase` for this milestone.

### Phase M4: Polish & Iteration (Future)

**Rationale:** Features that improve UX after core functionality is validated. These can be added incrementally based on actual usage patterns.

**Delivers:**
- Keyboard shortcuts (j/k navigation, m to mark read, r to refresh)
- Training feedback loop (mark "more/less like this")
- Interest categorization (auto-tag articles by topic)
- Article search (find past articles by keyword)
- Starred/saved articles (bookmark for later)
- Article retention policy (cleanup old articles, prevent unbounded database growth)

**Research flag:** Standard patterns for most features, skip research.

### Phase Ordering Rationale

- **M1 before M2:** Must have working UI before adding feed management complexity. Docker deployment establishes production foundation.
- **M2 before M3:** Feed organization needed to manage multiple feeds before LLM scoring scales beyond test feeds. OPML import enables switching from existing reader.
- **M3 as separate milestone:** LLM integration is complex (Ollama setup, prompt engineering, batch pipeline) and risky (quality, latency). Isolating it allows focused testing and iteration.
- **M4 deferred:** Polish features validated by actual usage, not assumptions. Keyboard shortcuts, search, and feedback loop are valuable but not critical for proving core concept.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase M3 (LLM Scoring):** Complex integration with limited examples. Needs research on: Ollama batch processing patterns, prompt engineering for article scoring, JSON response parsing reliability, handling model loading delays, scoring quality evaluation. Consider `/gsd:research-phase` for this milestone.

Phases with standard patterns (skip research-phase):
- **Phase M1 (Frontend MVP + Docker):** Well-documented patterns (Next.js App Router, Chakra UI setup, Docker Compose best practices). Official docs sufficient.
- **Phase M2 (Feed Management):** Standard CRUD operations, OPML is well-established format with library support (feedparser handles it).
- **Phase M4 (Polish):** Mostly UI/UX improvements with established patterns (keyboard event handlers, search indexing, retention policies).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified against official documentation (Next.js, Chakra UI, Ollama, Docker). Library versions confirmed via npm/GitHub. Docker patterns cross-referenced with official docs. |
| Features | HIGH | Feature tiers based on competitive analysis of 5+ RSS readers (Feedly, NewsBlur, The Old Reader). LLM curation patterns verified via multiple open-source projects (Precis, RLLM, RSSFilter). Table stakes vs differentiators clearly defined. |
| Architecture | HIGH | Patterns verified against official Next.js, FastAPI, and Docker documentation. Server Components vs Client Components boundaries well-documented. Batch LLM scoring pattern confirmed via Ollama production guides. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls (SQLite concurrency, RSS parsing, Docker volumes) verified via official docs and multiple production war stories. Ollama pitfalls based on community sources (Medium, dev.to) — less authoritative but consensus across multiple sources. |

**Overall confidence:** HIGH

### Gaps to Address

Areas where research was inconclusive or needs validation during implementation:

- **Ollama prompt engineering for article scoring:** Research confirms batch processing patterns and API integration, but optimal prompt structure for interest scoring needs experimentation. Handle during Phase M3 planning: prototype with sample articles, iterate on prompt templates, measure consistency.

- **SQLite performance at scale:** Research confirms WAL mode handles concurrency, but thresholds for "too many articles" or "too many feeds" vary by source. Handle pragmatically: implement retention policy (M4) if database exceeds 10K articles, monitor query performance, migrate to PostgreSQL only if actual bottleneck appears (unlikely for single-user).

- **Chakra UI v3 + Next.js 16 edge cases:** Both are recent releases (Next.js 16 stable as of late 2025, Chakra v3 in 2026). Some integration patterns may have undocumented gotchas. Handle during Phase M1: follow official Chakra + Next.js guide exactly, test SSR build early, monitor GitHub issues for emerging patterns.

- **Feed refresh timing optimization:** Research recommends respecting TTL/Cache-Control headers and exponential backoff, but specific thresholds vary. Handle during Phase M2: start with fixed 30-min refresh, implement per-feed configurable intervals if needed based on actual feed behavior (some blogs update hourly, others weekly).

## Sources

### Primary (HIGH confidence)

**Technology Stack:**
- [Next.js 16 Release](https://nextjs.org/blog/next-16) — Official announcement, breaking changes, Turbopack stability
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — Migration path, async params, middleware changes
- [Chakra UI with Next.js App](https://chakra-ui.com/docs/get-started/frameworks/next-app) — Official v3 setup for App Router
- [TanStack Query Installation](https://tanstack.com/query/v5/docs/react/installation) — v5 docs, RSC integration
- [Ollama JavaScript Library](https://github.com/ollama/ollama-js) — Official SDK, API reference
- [Docker Compose Reference](https://docs.docker.com/reference/compose-file/services/) — Official compose file specification
- [Docker Volumes](https://docs.docker.com/get-started/docker-concepts/running-containers/persisting-container-data/) — Persistence guide

**Architecture Patterns:**
- [Next.js Architecture in 2026](https://www.yogijs.tech/blog/nextjs-project-architecture-app-router) — Server-first patterns, Client Islands
- [Using Chakra UI in Next.js (App)](https://chakra-ui.com/docs/get-started/frameworks/next-app) — SSR setup, ColorModeScript
- [CORS (Cross-Origin Resource Sharing) - FastAPI](https://fastapi.tiangolo.com/tutorial/cors/) — Official CORS configuration
- [Use Compose in Production | Docker Docs](https://docs.docker.com/compose/how-tos/production/) — Production best practices

### Secondary (MEDIUM confidence)

**Features Research:**
- [The 3 best RSS reader apps in 2026 | Zapier](https://zapier.com/blog/best-rss-feed-reader-apps/) — Competitive feature analysis
- [RSS Reader Showdown: Feedly vs Inoreader vs NewsBlur](https://vpntierlists.com/blog/rss-reader-showdown-feedly-vs-inoreader-vs-newsblur-vs-spark) — Competitor comparison
- [Using LLMs to Build Smart RSS Readers - PhaseLLM Tutorial](https://phasellm.com/tutorial-smart-rss-reader) — LLM curation patterns
- [Precis: AI-enabled RSS reader](https://github.com/leozqin/precis) — Open-source LLM RSS reader reference
- [RSS Reader User Interface Design Principles](https://www.feedviewer.app/answers/rss-reader-user-interface-design-principles) — UX best practices

**Pitfalls Research:**
- [SQLite Concurrent Writes and Database Locked Errors](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) — WAL mode, busy timeout
- [Stop Misusing Docker Compose in Production](https://dflow.sh/blog/stop-misusing-docker-compose-in-production-what-most-teams-get-wrong) — Volume pitfalls, restart policies
- [Parsing RSS At All Costs](https://www.xml.com/pub/a/2003/01/22/dive-into-xml.html) — Feed parsing fragility
- [Large Scale Batch Processing with Ollama](https://robert-mcdermott.medium.com/large-scale-batch-processing-with-ollama-1e180533fb8a) — Batch scoring patterns
- [Hydration Failed: Debugging Next.js and Chakra UI](https://medium.com/@lehetar749/hydration-failed-debugging-next-js-v15-and-chakra-ui-component-issues-707b53730257) — SSR setup

### Tertiary (LOW confidence, needs validation)

- [Common Mistakes in Local LLM Deployments](https://sebastianpdw.medium.com/common-mistakes-in-local-llm-deployments-03e7d574256b) — Quantization issues (Medium paywall, single source)
- Community guides on date-fns vs Day.js bundle size comparisons — Multiple sources agree but no official benchmark
- State management comparisons (Zustand vs Jotai vs Redux) — Dev.to articles, subjective preferences

---
*Research completed: 2026-02-04*
*Ready for roadmap: yes*
