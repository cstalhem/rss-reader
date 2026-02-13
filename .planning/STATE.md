# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** Surface interesting articles and hide noise automatically via local LLM curation
**Current focus:** Phase 4 - LLM Content Curation

## Current Position

Phase: 4 of 5 in progress (LLM Content Curation)
Plan: 4 of 5 complete
Status: Plan 04-04 complete — visual scoring display with tags and indicators
Last activity: 2026-02-13 - Completed plan 04-04: Visual Scoring Display

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: ~3.5 minutes
- Total execution time: ~1.75 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01    | 3     | ~35 min | ~12 min |
| 02    | 4     | ~15 min | ~4 min |
| 03    | 4     | ~20 min | ~5 min |
| 04    | 4     | ~12 min | ~3 min |

**Recent Trend:**
- Last 5 plans: 04-01, 04-02, 04-03, 04-04
- Trend: Consistent fast execution (~2.5 min average for recent plans)

*Updated after each plan completion*
| Phase 04-llm-content-curation P04-04 | 141 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Chakra UI for frontend (prop-based theming, dark/light mode built-in)
- Ollama for LLM (privacy, no API costs, runs on home server)
- SQLite over Postgres (simple, no ops, sufficient for single-user)
- APScheduler over cron/Celery (in-app, Docker-friendly)
- Production Docker Compose (home server deployment, needs robustness)
- Pydantic Settings for config (01-01: type-safe, env var override support)
- SQLite WAL mode via events (01-01: concurrent access, prevent locks)
- Relative default DB path (01-01: ./data for dev, /data via env for containers)
- Dark mode default for UI (02-01: user preference, typical RSS reader use case)
- Orange accent color oklch(64.6% 0.222 41.116) (02-01: brand consistency)
- Dual font system: Inter for UI, Lora for article reader (02-01: readability)
- TanStack Query for data layer (02-02: caching, background sync, optimistic updates)
- Optional filter pattern for backward compatibility (02-02: is_read parameter None by default)
- QueryClient staleTime 30s (02-02: responsive UX without excessive requests)
- Load-more pagination pattern (02-03: user preference over infinite scroll)
- Unread-first default view (02-03: show unread only by default)
- Relaxed list layout with breathing room (02-03: py=3 px=4 spacing)
- Read state visual indicators (02-03: opacity 0.6 + no dot for read, full opacity + accent dot for unread)
- 12-second auto-mark-as-read timer (02-04: balances engagement signal vs accidental marks)
- ~75% drawer width on desktop (02-04: comfortable reading without losing list context)
- Content fallback strategy (02-04: article.content || article.summary for flexible RSS feed support)
- Feed ordering via display_order field (03-01: integer field, assigned sequentially on creation)
- CASCADE delete at database level (03-01: SQLite foreign key constraints for automatic article cleanup)
- URL validation on feed creation (03-01: require http:// or https:// prefix, reject duplicates)
- Direct composition over render props (03-02→fix: Server Components can't pass functions to Client Components)
- localStorage for sidebar collapse state (03-02: persist user preference without backend)
- Three-step add feed dialog flow (03-02: url → loading → success enables rename without closing)
- [Phase 03-03]: Drag-to-reorder on desktop only, mobile swipe actions
- [Phase 03-03]: 5px drag activation constraint to prevent accidental drags
- [Phase 03-03]: Inline rename via double-click (desktop) and long-press (mobile)
- [Quick-03]: Delete globals.css entirely — Chakra's @layer reset sufficient, unlayered CSS breaks recipes
- [Quick-03]: All app-wide CSS in Chakra's globalCss for proper layering (no separate CSS files)
- [Quick-03]: Use defineRecipe to override Chakra component defaults (button: orange accent, increased padding)
- [Quick-04]: Complete semantic token set (solid, contrast, focusRing) required for Chakra v3 colorPalette resolution
- [Quick-04]: Global link styling via globalCss — accent.500 default, accent.400 on hover
- [Quick-05]: All CTA/add-feed buttons use colorPalette="accent" for design system consistency
- [Quick-05]: ArticleReader inherits global link colors — only adds textDecoration: underline locally
- [Phase 04-01]: Single-row UserPreferences table (single-user app)
- [Phase 04-01]: SQLAlchemy JSON columns for list/dict fields (categories, topic_weights)
- [Phase 04-01]: Case-insensitive category keys normalized to lowercase
- [Phase 04-01]: No health check on Ollama service — scoring queue handles unavailability via retry
- [Phase 04-02]: Two-step LLM pipeline: categorize all articles, score non-blocked only
- [Phase 04-02]: Composite score formula: interest * category_weight * quality_multiplier (cap 20.0)
- [Phase 04-02]: Scoring queue processes oldest articles first (batch size 5, every 30s)
- [Phase 04-03]: Segmented button group for category weights (blocked/low/neutral/medium/high)
- [Phase 04-03]: Immediate weight updates without separate save button for better UX
- [Phase 04-03]: Empty state guidance for categories before LLM scoring runs
- [Phase 04-04]: Color-coded tag weights (blocked=red/strikethrough, high=accent, neutral=default)
- [Phase 04-04]: Score display with color intensity based on value (>15=accent, >10=default, else=muted)

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 - RESOLVED:**
- ✅ SQLite write concurrency addressed via WAL mode
- ✅ Docker volume configuration uses named volumes
- ✅ Health check endpoint with proper startup ordering
- ✅ Docker builds verified working (user environment)

**Phase 4 considerations (future):**
- Ollama model quality depends on quantization level (Q6/Q8 recommended per research)
- LLM scoring latency must use batch processing, not on-demand during page load

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Refine reading panel design for airy feel with generous padding | 2026-02-09 | 2a0e2e4 | [1-refine-reading-panel-design-for-airy-fee](./quick/1-refine-reading-panel-design-for-airy-fee/) |
| 2 | Fix reader header padding and accent hover states | 2026-02-09 | a22cc9a | [2-fix-reader-header-padding-and-accent-ora](./quick/2-fix-reader-header-padding-and-accent-ora/) |
| 3 | Fix design system spacing — remove rogue CSS reset, increase button padding | 2026-02-10 | fc42e22 | [3-improve-design-system-spacing-defaults-f](./quick/3-improve-design-system-spacing-defaults-f/) |
| 3 | Fix design system spacing defaults by removing rogue CSS reset | 2026-02-10 | b635c15 | [3-improve-design-system-spacing-defaults-f](./quick/3-improve-design-system-spacing-defaults-f/) |
| 4 | Fix orange accent colorPalette resolution — add solid/contrast/focusRing tokens | 2026-02-10 | 6fda72a | [4-audit-and-fix-orange-accent-colorpalette](./quick/4-audit-and-fix-orange-accent-colorpalette/) |
| 5 | Add accent colorPalette to add-feed buttons and remove redundant link styling | 2026-02-10 | 8717467 | [5-add-accent-colorpalette-to-add-feed-butt](./quick/5-add-accent-colorpalette-to-add-feed-butt/) |

## Session Continuity

Last session: 2026-02-13 (plan execution)
Stopped at: Completed 04-04-PLAN.md — visual scoring display with tags and indicators
Resume file: None
