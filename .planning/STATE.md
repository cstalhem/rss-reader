# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Surface interesting articles and hide noise automatically via local LLM curation
**Current focus:** Phase 8 - Category Grouping

## Current Position

Phase: 8 of 9 (Category Grouping)
Plan: 11 of 11 complete
Status: Phase Complete (gap closure complete)
Last activity: 2026-02-17 - Reverted quick task 11 (hello-pangea/dnd migration) — collapsed accordion drop targets incompatible

Progress: [██████████] 100% (36/36 total plans estimated)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 19
- Average duration: ~5 minutes
- Total execution time: ~1.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01    | 3     | ~35 min | ~12 min |
| 02    | 4     | ~15 min | ~4 min |
| 03    | 4     | ~20 min | ~5 min |
| 04    | 5     | ~57 min | ~11 min |
| 05    | 3     | ~25 min | ~8 min |
| 06    | 1     | ~1 min | ~1 min |

*Carried forward from v1.0 for reference*

**Phase 06 Metrics:**
| Phase 06-ui-theme-polish P01 | 1.3 | 2 tasks | 3 files |
| Phase 06-ui-theme-polish P02 | 2.7 | 2 tasks | 5 files |
| Phase 06-ui-theme-polish P03 | 2.9 | 2 tasks | 6 files |

**Phase 07 Metrics:**
| Phase 07-ollama-configuration-ui P01 | 4.0 | 2 tasks | 6 files |
| Phase 07-ollama-configuration-ui P02 | 5.4 | 2 tasks | 11 files |
| Phase 07-ollama-configuration-ui P03 | 4.0 | 2 tasks | 5 files |
| Phase 07-ollama-configuration-ui P04 | 5.0 | 3 tasks | 3 files |
| Phase 07-ollama-configuration-ui P05 | 2.0 | 2 tasks | 2 files |
| Phase 07-ollama-configuration-ui P06 | 2.0 | 3 tasks | 4 files |

**Phase 08 Metrics:**
| Phase 08-category-grouping P01 | 3.0 | 2 tasks | 5 files |
| Phase 08-category-grouping P02 | 5.0 | 2 tasks | 9 files |
| Phase 08-category-grouping P03 | 2.5 | 2 tasks | 4 files |
| Phase 08-category-grouping P04 | 5.8 | 2 tasks | 5 files |
| Phase 08-category-grouping P05 | 2.0 | 1 tasks | 2 files |
| Phase 08-category-grouping P06 | 3.7 | 2 tasks | 2 files |
| Phase 08-category-grouping P07 | 7.0 | 2 tasks | 3 files |
| Phase 08-category-grouping P08 | 5.0 | 2 tasks | 3 files |
| Phase 08-category-grouping P09 | 2.0 | 1 tasks | 2 files |
| Phase 08-category-grouping P10 | 2.0 | 1 tasks | 1 files |
| Phase 08-category-grouping P11 | 3.0 | 2 tasks | 1 files |

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Categories Settings UI Redesign (INSERTED) — accordion-based category grouping has fundamental DnD issues with collapsed drop targets; needs full UX rethink before feedback system

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v1.0 decisions archived in milestones/v1.0-ROADMAP.md — full log in STATE.md history.

Key architectural decisions carrying forward to v1.1:
- Two-step LLM pipeline (categorize → score) with separate models - enables independent optimization in Phase 7
- Composite scoring formula with interest × category_weight × quality_multiplier - foundation for Phase 8 grouping and Phase 9 feedback
- Pydantic Settings config with `@lru_cache` - creates constraint for Phase 7 (need two-tier config pattern)
- [Phase 06-ui-theme-polish]: Use OKLCH color space with hue ~55 (warm amber) and low chroma (0.01-0.02) for subtle warmth
- [Phase 06-ui-theme-polish]: Three distinct surface levels: bg.DEFAULT (15%), bg.subtle (17%), bg.panel (16%)
- [Phase 07-01]: Two-tier config: UserPreferences for runtime model names, Pydantic Settings for host/thinking/infrastructure
- [Phase 07-01]: Module-level state for download tracking (safe in single-worker asyncio)
- [Phase 07-01]: Score-only re-scoring skips categorization when only scoring model changed
- [Phase 07-02]: useReducer overlay pattern for form state to avoid setState-in-effect lint violations
- [Phase 07-02→07-06]: Upgraded NativeSelect to Chakra Select.Root with Portal/Positioner pattern for model dropdowns
- [Phase 07-03]: fetch+ReadableStream for SSE (not EventSource) because pull endpoint is POST
- [Phase 07-03→07-06]: Pulsing LuDownload icon via Emotion keyframes for download activity on sidebar
- [Phase 07-05]: Explicit intervalMs state for TanStack Query refetchInterval to ensure polling restarts after remount
- [Phase 07-05]: Full-width progress bar layout below trigger elements for consistent UX across all download types
- [Phase 08-01]: Three-tier weight resolution: explicit override > group weight > default normal (1.0)
- [Phase 08-01]: category_groups JSON structure: {groups, hidden_categories, seen_categories, returned_categories}
- [Phase 08-01]: New weight names: block/reduce/normal/boost/max (old names kept as fallback aliases)
- [Phase 08-02]: useCategories hook centralizes all category state management (groups, counts, mutations)
- [Phase 08-02]: ArticleReader uses direct useMutation for inline tag weight changes (decoupled from usePreferences)
- [Phase 08-03]: Compact Button group for weight presets (solid+accent active, ghost inactive) instead of SegmentGroup
- [Phase 08-03]: Accordion header split pattern: trigger on left, presets on right outside trigger with stopPropagation
- [Phase 08-04→Quick 11]: DragDropContext with Droppable/Draggable render props for cross-container category drag-and-drop (@hello-pangea/dnd)
- [Phase 08-04]: No optimistic onDragOver state -- move persists only on dragEnd for simplicity
- [Phase 08-04]: FeedRow rename pattern replicated for group names (double-click desktop, long-press mobile)
- [Phase 08-05]: Header dot badge via shared TanStack Query key reuses same cache as useCategories and SettingsSidebar
- [Phase 08-05]: Auto-acknowledge categories on weight or group weight change for seamless badge dismissal
- [Phase 08-06]: scrollbar-gutter: stable on content wrapper reserves space permanently, preventing sidebar shift
- [Phase 08-07]: Chakra Group+attached for segmented control weight preset buttons
- [Phase 08-07]: Fixed-width Box placeholder for conditional reset button to prevent layout shift
- [Phase 08-07]: Parent Flex hover instead of trigger-only hover for full-row group header coverage
- [Phase 08-08]: Hover-reveal pencil button replaces double-click/long-press for group rename (avoids accordion toggle conflict)
- [Phase 08-08]: Opacity-only visibility for badge X icon to avoid layout shift on hover
- [Phase 08-09/11]: Source container tracking prevents drag placeholder from appearing in source (only destination)
- [Phase 08-11]: Drag placeholder rendered outside Accordion.ItemContent for visibility when group is collapsed
- [Quick 10]: useDroppable setNodeRef on Accordion.Item (always visible) instead of Box inside ItemContent (zero dimensions when collapsed)
- [Quick 11]: Migrated all DnD from @dnd-kit to @hello-pangea/dnd -- Draggable/Droppable render props replace useSortable/useDraggable/useDroppable hooks, DragOverlay removed

### Pending Todos

1. **Establish design and UX principles for next milestone** (area: ui) — Define semantic status colors, interaction patterns, responsive UX conventions for v1.2+
2. **Codebase evaluation and simplification phase** (area: general) — Thorough evaluation of codebase, architecture, and data models to surface simplifications and address technical debt (hard-coded values, duplicated logic, inconsistencies) while retaining all functionality
3. **Fix Ollama client file descriptor leak** (area: backend, severity: blocker) — `scoring.py:categorize_article` creates a new `ollama.AsyncClient` per call without closing it, leaking httpx connections and SSL contexts. After ~60-70 articles the process hits `OSError: [Errno 24] Too many open files` and stops accepting connections. Fix: reuse a single client instance or properly close after each call.

### Blockers/Concerns

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 6 | Fix production API URL fallback: change \|\| to ?? so empty NEXT_PUBLIC_API_URL uses relative URLs | 2026-02-14 | a979370 | [6-fix-production-api-url-fallback-change-t](./quick/6-fix-production-api-url-fallback-change-t/) |
| 7 | Switch frontend Docker build from npm to bun for faster CI builds | 2026-02-14 | 6cf07cc | [7-switch-frontend-docker-build-from-npm-to](./quick/7-switch-frontend-docker-build-from-npm-to/) |
| 8 | Switch Ollama client to streaming responses to prevent timeouts on slower models | 2026-02-15 | 7e0add4 | [8-switch-ollama-client-to-streaming-respon](./quick/8-switch-ollama-client-to-streaming-respon/) |
| 9 | Consolidate Ollama disconnected state, split Model Library sub-sections, remove redundant SystemPrompts label | 2026-02-15 | 30be07b | [9-update-ollama-settings-panel-headings-se](./quick/9-update-ollama-settings-panel-headings-se/) |
| 10 | Fix category drag-and-drop placeholder (destination detection) and badge dismiss X spacing/size/divider | 2026-02-16 | 0ffaebc | [10-fix-category-drag-and-drop-placeholder-a](./quick/10-fix-category-drag-and-drop-placeholder-a/) |
| 11 | ~~Migrate all DnD from @dnd-kit to @hello-pangea/dnd~~ (reverted: collapsed accordion drop targets incompatible) | 2026-02-17 | 34908f2 | [11-migrate-drag-and-drop-from-dnd-kit-to-he](./quick/11-migrate-drag-and-drop-from-dnd-kit-to-he/) |

**Phase 7 considerations:**
- Pydantic Settings `@lru_cache` prevents runtime updates - requires two-tier config pattern (Settings for infrastructure, UserPreferences for runtime choices)
- Ollama model switching during active scoring creates race condition - needs investigation during planning (retry vs queue pause)

**Phase 9 considerations:**
- Feedback aggregation strategy is custom (no standard implementation) - flagged for deeper research during planning
- Minimum sample size and weight delta parameters are heuristics not empirically validated - start conservative, monitor in production

## Session Continuity

Last session: 2026-02-17
Stopped at: Phase 08.1 context gathered — categories-as-parents tree view, manual creation, seeded base categories, DnD with always-expanded tree
Resume file: .planning/phases/08.1-categories-settings-ui-redesign/08.1-CONTEXT.md

---
*State initialized: 2026-02-14*
*Last updated: 2026-02-17 after Phase 08.1 context gathering*
