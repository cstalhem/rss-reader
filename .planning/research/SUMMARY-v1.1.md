# Research Summary: RSS Reader v1.1 Features

**Domain:** RSS Reader — Subsequent milestone adding configuration, real-time push, feedback loop, feed organization, and polish
**Researched:** 2026-02-14
**Overall confidence:** HIGH

## Executive Summary

v1.1 features require minimal stack additions. The existing FastAPI + SQLModel + Next.js + Chakra UI foundation supports all planned features with only three new backend libraries: **sse-starlette** (3.2.0) for Server-Sent Events push updates, **feedsearch-crawler** (1.0.3+) for RSS feed auto-discovery, and **httpx** for Ollama REST API queries. Frontend requires zero new dependencies — browser-native EventSource API handles SSE, and existing Chakra UI v3 components cover all UI polish needs.

Key architectural decisions favor simplicity over complexity: SSE replaces polling (not WebSockets), simple feedback scoring replaces RLHF, and custom React hooks replace library abstractions. The LLM feedback loop uses category-weighted scoring adjustments stored in SQLite JSON columns rather than training reward models. Feed categories use a simple nullable string field rather than hierarchical structures.

All new capabilities integrate cleanly with existing patterns: TanStack Query for data fetching, APScheduler for background jobs, Pydantic Settings for configuration, and SQLModel for database extensions. No architectural changes or refactoring required.

## Key Findings

**Stack:** Three new backend libraries (sse-starlette, feedsearch-crawler, httpx), zero new frontend libraries. Browser APIs and existing Chakra UI sufficient.

**Architecture:** SSE event stream complements TanStack Query (doesn't replace it). Feedback loop extends UserPreferences model with JSON aggregates. Ollama config stored in database with Pydantic Settings overrides. Feed categories as simple string field on Feed model.

**Critical pitfall:** Don't over-engineer feedback loop with full RLHF or separate UserFeedback table. Simple category weighting in prompt injection provides 80% value with 5% complexity for single-user local app.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase: Feed Management Enhancements** - Feed categories/folders, feed auto-discovery
   - Addresses: Feed organization, easier feed addition workflow
   - Avoids: Complex hierarchical category systems (string field sufficient)

2. **Phase: Real-Time Push Infrastructure** - SSE endpoint, custom useSSE hook, query invalidation
   - Addresses: Eliminates polling, real-time UI updates for scoring/refresh
   - Avoids: WebSockets over-engineering, replacing TanStack Query entirely

3. **Phase: Ollama Configuration UI** - Model selection, connection status, config persistence
   - Addresses: Expose LLM model choice to users, validate Ollama connectivity
   - Avoids: ollama-python library (use httpx + REST API directly)

4. **Phase: LLM Feedback Loop** - Feedback collection, category weight adjustment, prompt injection
   - Addresses: User-driven scoring refinement, preference learning
   - Avoids: Full RLHF, reward model training, separate feedback table
   - Requires: SSE (for real-time score updates after feedback)

5. **Phase: UI & Theme Polish** - Spacing refinements, loading states, animations, responsive improvements
   - Addresses: Visual polish, perceived performance, mobile experience
   - Avoids: New component libraries, major redesigns

**Phase ordering rationale:**
- Feed management first: simplest changes (data model + CRUD endpoints), no dependencies
- SSE second: infrastructure for feedback loop, moderate complexity
- Ollama config third: independent feature, moderate complexity
- Feedback loop fourth: requires SSE, highest complexity, integrates with scoring pipeline
- UI polish last: refinement across all features once functionality complete

**Research flags for phases:**
- Phase 1 (Feed Management): Standard patterns, unlikely to need research
- Phase 2 (SSE): Likely needs deeper research on EventSource error handling, reconnection strategies, and SSE with Docker/Traefik
- Phase 3 (Ollama Config): Likely needs research on Ollama API edge cases (timeout handling, model not found, server offline)
- Phase 4 (Feedback Loop): May need research on prompt engineering for category weight injection, feedback aggregation strategies
- Phase 5 (UI Polish): Standard Chakra UI usage, unlikely to need research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified via official docs, PyPI, and current (2026) sources. sse-starlette released Jan 2026, actively maintained. |
| Integration | HIGH | All additions integrate with existing patterns (FastAPI endpoints, TanStack Query, Pydantic Settings, SQLModel extensions). No architectural changes needed. |
| SSE Implementation | MEDIUM | EventSource API is stable, but SSE with FastAPI background jobs + Docker/Traefik routing may have edge cases. Reconnection logic needs careful design. |
| Feedback Loop | HIGH | Pattern is well-established in recommendation systems. Aggregated implicit feedback sufficient for single-user app. Prompt injection for weight adjustment is straightforward. |
| Feed Discovery | HIGH | feedsearch-crawler actively maintained, handles standard RSS auto-discovery patterns. Async/aiohttp matches FastAPI patterns. |
| Ollama API | HIGH | REST API well-documented, simple endpoints (`/api/tags`, `/api/show`). httpx sufficient, no library needed. |

## Gaps to Address

### Areas where research was inconclusive:

**SSE with Docker/Traefik:**
- How does Traefik handle long-lived SSE connections?
- Does Traefik require specific configuration for streaming responses?
- Are there timeout settings that might break SSE connections?
- *Resolution:* Phase-specific research during Phase 2 (SSE implementation)

**EventSource edge cases:**
- What happens when client goes to sleep (laptop lid close)?
- How does EventSource behave during network transitions (WiFi to cellular)?
- Browser limits on concurrent EventSource connections?
- *Resolution:* Phase-specific research during Phase 2 (SSE implementation)

**Ollama API edge cases:**
- Behavior when Ollama server is stopped mid-request
- Timeout handling for slow model loading
- Model not found vs server offline error differentiation
- *Resolution:* Phase-specific research during Phase 3 (Ollama Config UI)

### Topics needing phase-specific research later:

**Phase 2 (SSE):**
- SSE connection lifecycle in production (Traefik, Docker networking, SSL)
- Error handling strategies (exponential backoff, connection limits)
- SSE security (authentication, rate limiting)

**Phase 3 (Ollama Config UI):**
- Ollama server health check best practices
- Model metadata display (VRAM usage, quantization level)
- Graceful degradation when Ollama unavailable

**Phase 4 (Feedback Loop):**
- Prompt engineering for effective category weight injection
- Feedback decay strategies (older feedback matters less?)
- Preventing feedback loops (user feedback, score, more similar articles, more feedback)

**Phase 5 (UI Polish):**
- None expected - standard Chakra UI usage

## Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Real-time push | SSE (not WebSockets) | Unidirectional server to client, simpler protocol, automatic reconnection, HTTP/2 native |
| SSE client | Native EventSource (not library) | Stable browser API, libraries add minimal value, reduces dependencies |
| Feed discovery | feedsearch-crawler | Async, actively maintained, comprehensive pattern coverage |
| Ollama API client | httpx (not ollama-python) | Simple REST API, direct control, already in FastAPI ecosystem |
| Feedback storage | JSON column in UserPreferences | Aggregated category-level data, avoids separate table for single-user app |
| Feedback algorithm | Simple category weighting (not RLHF) | 80% value, 5% complexity, appropriate for single-user local app |
| Feed categories | Nullable string field (not hierarchical) | Flat structure sufficient for single-user, extensible to paths if needed |
| Query management | Keep TanStack Query + add SSE | SSE for push, Query for fetching/caching/mutations - complementary not competing |
