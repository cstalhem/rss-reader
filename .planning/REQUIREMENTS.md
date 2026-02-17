# Requirements: RSS Reader

**Defined:** 2026-02-14
**Core Value:** Surface interesting articles and hide noise automatically via local LLM curation

## v1.1 Requirements

Requirements for milestone v1.1 — Configuration, Feedback & Polish. Each maps to roadmap phases.

### Ollama Configuration

- [ ] **OLLAMA-01**: User can see Ollama connection health status (connected/disconnected indicator)
- [ ] **OLLAMA-02**: User can select categorization and scoring models from list of locally available models
- [ ] **OLLAMA-03**: User can download new Ollama models from within the UI with progress indication
- [ ] **OLLAMA-04**: User can view current system prompts used for categorization and scoring (read-only)
- [ ] **OLLAMA-05**: User can trigger batch re-scoring of recent articles after changing model or config

### LLM Feedback Loop

- [ ] **FEEDBACK-01**: User can give thumbs up/down feedback on any article
- [ ] **FEEDBACK-02**: System aggregates feedback by category and displays patterns in Settings
- [ ] **FEEDBACK-03**: System suggests category weight adjustments based on aggregated feedback
- [ ] **FEEDBACK-04**: System suggests interest text rewrites based on thumbed up/down article patterns

### Category Grouping

- [x] **CATGRP-01**: User can create named category groups (e.g., "Programming", "Vehicles")
- [x] **CATGRP-02**: User can drag existing categories into groups via tree UI
- [x] **CATGRP-03**: User can set a weight on a group that cascades to all child categories
- [x] **CATGRP-04**: User can override the cascaded weight for individual categories within a group
- [x] **CATGRP-05**: Scoring pipeline resolves effective weight: explicit override > group default > 1.0

### UI & Theme Polish

- [ ] **POLISH-01**: Soften dark mode color scheme — reduce saturation/contrast for backgrounds and accents
- [ ] **POLISH-02**: Add loading skeletons for article list and settings pages
- [ ] **POLISH-03**: Add error toasts for API failures and success toasts for settings saves
- [ ] **POLISH-04**: Reorganize Settings page with clear sections/tabs
- [ ] **POLISH-05**: Improve reader drawer typography and spacing for better reading experience
- [ ] **POLISH-06**: Add empty state prompts (no articles, no feedback yet, no categories configured)

## Future Requirements

Deferred to v1.2 or later. Tracked but not in current roadmap.

### Real-Time Updates

- **SSE-01**: Server pushes article score updates to frontend via Server-Sent Events
- **SSE-02**: Frontend replaces polling with SSE subscription for instant updates
- **SSE-03**: Connection status indicator shows live/disconnected state

### Feed Organization

- **FORG-01**: User can create feed folders/categories to group feeds
- **FORG-02**: User can drag feeds between folders
- **FORG-03**: Sidebar shows feeds grouped by folder with collapse/expand

### Feed Discovery

- **DISC-01**: User can enter a blog URL and system discovers RSS feed automatically
- **DISC-02**: System presents discovered feeds for user selection
- **DISC-03**: SSRF protection blocks private IP ranges in discovery requests

### Advanced Feedback

- **ADVFB-01**: Feedback-driven automatic weight adjustment (without user confirmation)
- **ADVFB-02**: Prompt template editing (write access to system prompts)
- **ADVFB-03**: Category merge/rename tools for consolidating similar categories

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full RLHF training pipeline | Overkill for personal app — simple weight adjustment sufficient |
| Real-time model switching mid-scoring | Expensive, causes inconsistent batches — pause queue instead |
| Automatic model downloads without confirmation | Invasive (4-30GB), could fill disk |
| Category auto-merge via LLM similarity | Removes user control — manual merge preferred |
| Category hierarchy deeper than 2 levels | Scoring formula complexity outweighs benefit |
| Multi-user support | Personal use only |
| Mobile native app | Web-first, responsive layout sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| POLISH-01 | Phase 6 | Pending |
| POLISH-02 | Phase 6 | Pending |
| POLISH-03 | Phase 6 | Pending |
| POLISH-04 | Phase 6 | Pending |
| POLISH-05 | Phase 6 | Pending |
| POLISH-06 | Phase 6 | Pending |
| OLLAMA-01 | Phase 7 | Pending |
| OLLAMA-02 | Phase 7 | Pending |
| OLLAMA-03 | Phase 7 | Pending |
| OLLAMA-04 | Phase 7 | Pending |
| OLLAMA-05 | Phase 7 | Pending |
| CATGRP-01 | Phase 8 | Complete |
| CATGRP-02 | Phase 8 | Complete |
| CATGRP-03 | Phase 8 | Complete |
| CATGRP-04 | Phase 8 | Complete |
| CATGRP-05 | Phase 8 | Complete |
| FEEDBACK-01 | Phase 9 | Pending |
| FEEDBACK-02 | Phase 9 | Pending |
| FEEDBACK-03 | Phase 9 | Pending |
| FEEDBACK-04 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

**100% coverage achieved**

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after roadmap creation*
