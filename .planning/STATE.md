# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** Surface interesting articles and hide noise automatically via local LLM curation
**Current focus:** Milestone 1 complete — all 5 phases delivered

## Current Position

Phase: 5 of 5 complete (Interest-Driven UI)
Plan: 3 of 3 complete
Status: All milestone 1 phases complete — RSS reader with LLM-powered content curation operational
Last activity: 2026-02-14 - Phase 5 verified and complete

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: ~3.3 minutes
- Total execution time: ~1.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01    | 3     | ~35 min | ~12 min |
| 02    | 4     | ~15 min | ~4 min |
| 03    | 4     | ~20 min | ~5 min |
| 04    | 5     | ~57 min | ~11 min |
| 05    | 3     | ~25 min | ~8 min |

**Recent Trend:**
- Last 5 plans: 04-04, 04-05, 05-01, 05-02
- Trend: Phase 5 plans fast on Sonnet 4.5 (~2-3 min)

*Updated after each plan completion*

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
- [Phase 04-05]: SQLite busy_timeout=5000ms for concurrent scoring/API writes
- [Phase 04-05]: Startup recovery resets orphaned scoring→queued state
- [Phase 04-05]: Reassign JSON dicts (not mutate in-place) for SQLAlchemy change detection
- [Phase 04-05]: Default Ollama model deepseek-r1:8b (user's available model)
- [Phase 04-05]: Categorization prompt: max 4 broad kebab-case categories, ignore incidental mentions
- [Phase 04-05]: Conditional TanStack Query polling (5s) during active scoring
- [Phase 04-05]: Single orange toggle dot for read/unread state (replaces dual indicators)
- [Phase 04-05]: Feed name shown only in all-articles view, hidden for single-feed
- [Phase 05-01]: Default sort: composite_score descending (score-first workflow)
- [Phase 05-01]: NULL composite_scores pushed to end with nulls_last() (SQLAlchemy)
- [Phase 05-01]: Pending tab auto-overrides to oldest-first (published_at ASC) for catch-up workflow
- [Phase 05-01]: Secondary sorts for stability (score→published_at ASC, date→id)
- [Phase 05-01]: useSortPreference hook wraps useLocalStorage with "score_desc" default
- [Phase 05-01]: TanStack Query queryKey includes sort/filter params for cache correctness
- [Phase 05-02]: Score badge color tiers: >=15 accent solid, >=8 gray subtle, <8 gray outline
- [Phase 05-02]: Accent.subtle background tint for high-scored rows (>=15) with hover override
- [Phase 05-02]: Blocked articles hidden from Unread/All via exclude_blocked=true default
- [Phase 05-02]: Scoring tab count = unscored+queued+scoring, tabs disabled when count=0
- [Phase 05-02]: Chakra v3 Tooltip.Root/Trigger/Content pattern for score badge tooltips
- [Phase 05-03]: Articles hidden from Unread/All until scoring completes (scored + non-blocked filter)
- [Phase 05-03]: Adaptive polling: useScoringStatus 5s active / 30s idle, useArticles 10s when scoring active
- [Phase 05-03]: Scoring completion animation via useLayoutEffect (detects disappearances before paint)
- [Phase 05-03]: Position-preserving merge in useCompletingArticles (completing articles stay in place)
- [Phase 05-03]: English-only categories enforced in categorization prompt
- [Phase 05-03]: Default LLM model switched from deepseek-r1:8b to qwen3:8b

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 - RESOLVED:**
- ✅ SQLite write concurrency addressed via WAL mode
- ✅ Docker volume configuration uses named volumes
- ✅ Health check endpoint with proper startup ordering
- ✅ Docker builds verified working (user environment)

**Phase 4 - RESOLVED:**
- ✅ Ollama scoring operational with deepseek-r1:8b
- ✅ Batch processing via scoring queue (5 articles per batch, 30s interval)
- ✅ SQLite concurrency resolved via busy_timeout pragma
- ✅ Startup recovery for orphaned scoring states

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

Last session: 2026-02-14 (phase completion)
Stopped at: Milestone 1 complete — all phases delivered
Resume file: None
