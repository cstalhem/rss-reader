# Phase 4: LLM Content Curation - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Automatic interest scoring of articles using a local LLM (Ollama). Users define preferences (prose + weighted topic categories), articles are categorized and scored through a two-step LLM pipeline, and results are stored with reasoning. This phase builds the scoring backend, preference management UI (settings page), and visual display of scores/tags on articles. Sorting/filtering by score belongs in Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Interest Preferences
- Hybrid input: free-form prose (primary) + structured topic weights (overrides)
- Prose input split into two sections: "Interests" and "Anti-interests"
- Topic weights use a unified scale: blocked / low / neutral / medium / high
- Preference editor lives on a dedicated settings page (not sidebar)
- Include example placeholder text in preference fields to guide first-time setup
- Explicit preferences only for Phase 4 — no implicit behavior learning
- Saving preferences triggers re-scoring of recent articles (roughly last week)

### Scoring Pipeline (Two-Step LLM)
- **Step 1 — Categorization (all articles):** Lightweight LLM prompt assigns topic tags from seeded+emergent taxonomy. Fast, runs on every new article.
- **Step 2 — Interest scoring (non-blocked articles):** Deeper LLM prompt evaluates against user's prose preferences. Returns interest score (0-10), quality signal, and 1-2 sentence reasoning.
- Blocked categories (from unified topic weights) skip Step 2 entirely — auto-score 0
- Final composite score computed in code: base interest score × topic weight multipliers × quality penalty
- Quality signal acts as a multiplier/penalty — low-quality articles sink in ranking but still appear

### Scoring Queue
- Articles enter a processing queue when fetched or when re-scoring is triggered
- Queue processed in chronological order (oldest first)
- Article scoring states: unscored → queued → scoring → scored
- UI shows scoring state indicators (e.g., spinner for "scoring", dash for "unscored")
- Unscored articles visible in the list, with ability to filter them in UI
- LLM returns structured response: interest score, quality score, topic tags, reasoning text
- Reasoning stored per article for transparency

### Category System
- Seeded + emergent: ship with pre-populated default categories, LLM can suggest new ones
- LLM prompt includes existing category list to encourage reuse and prevent duplicates
- Normalize categories (lowercase comparison) to avoid "Crypto" vs "crypto" duplication
- Target 1-6 categories per article, hard limit of 10
- Categories managed in settings page AND quick-block/boost from article tag chips in UI
- Blocked categories cause articles to skip interest scoring entirely

### Topic Tags in UI
- Tags displayed as small badges/chips on article rows in list view
- More prominent tag display in the reader drawer view
- Tags are display-only in this phase (click-to-filter deferred to Phase 5)

### Claude's Discretion
- Ollama model selection and prompt engineering
- Exact composite score formula and weight multipliers
- Queue implementation details (in-memory vs database-backed)
- Category normalization/deduplication strategy
- Default seed category list
- Settings page layout and form design
- Scoring state indicator visual design
- How to handle articles that fail LLM scoring (retry logic, error states)

</decisions>

<specifics>
## Specific Ideas

- User wants transparency into scoring: reasoning text per article explains why it was scored that way
- Quality signal should penalize fluff/clickbait without hiding it completely
- Keyword/category filtering operates on meaning (LLM-assigned categories) rather than raw text matching — avoids false positives like "crypto" matching "cryptography"
- Category blocking should feel like a quick action: see a tag on an article, block that category with a click
- Pipeline must handle slow local LLM speeds gracefully — queue system with visible progress

</specifics>

<deferred>
## Deferred Ideas

- Implicit behavior learning (time spent reading, read patterns) — future enhancement
- Explicit feedback mechanism (thumbs up/down, "more/less like this") — future enhancement
- Click-to-filter by category tag — Phase 5
- Category-based article sorting — Phase 5

</deferred>

---

*Phase: 04-llm-content-curation*
*Context gathered: 2026-02-10*
