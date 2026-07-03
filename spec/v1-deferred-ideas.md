# Ideas salvaged from the v1 backlog

Unshipped ideas extracted from v1's `DEFERRED.md` and pending todos before the planning
archive was deleted (full originals at tag `v1.1.2` under `.planning/`). Input material for
the v2 grilling/PRD session, alongside `prd.md`, `llm_scoring_vision.md`, and
`original_research.md`. Delete this file once the v2 PRD exists.

## Carried forward

### Linked-content and discussion fetching for scoring (was: pending todo, backend)

Link-aggregator feeds (Hacker News, Lobsters, Reddit) publish items that are just a title +
outbound URL — the scoring pipeline only sees RSS metadata and misses the actual substance.
The discussion thread also carries signal (expert commentary, corrections, debate).

Idea: opt-in setting to detect aggregator-style entries, fetch the linked page
(readability-style extraction), and feed extracted content into categorization/scoring.
Optionally detect the discussion URL and summarize it as a "worth reading" signal.
Design notes from v1: rate limiting/politeness, caching fetched content across re-scores,
graceful fallback to RSS-only, token budget management (truncate/summarize long articles).

v2 relevance: directly serves the "scores become more relevant" goal — richer input beats
better calibration on thin input. Pairs naturally with the feedback/learning layer.

### Real-time push updates instead of polling (was: DEFERRED #3, priority medium)

v1 polls (10s unread tab, 5s scoring tab), so articles can take up to 10s to appear after
scoring. Idea: Server-Sent Events from FastAPI (`StreamingResponse`) → TanStack Query cache
invalidation on events. WebSockets judged overkill (server→client only).

v2 relevance: the frontend data layer is being rebuilt anyway — decide polling vs SSE once,
now, rather than retrofitting later.

### Category lookup as a tool call for the categorization LLM (was: pending todo, backend)

The full category list is embedded in the categorization prompt. As it grows: context
pressure, staleness between prompt rebuilds, and hallucinated/misspelled category matches.
Idea: give the model a `search_categories` tool (lookup by keyword, returns names, parents,
IDs) instead of the embedded list; fall back to proposing a new category on no match.

v2 relevance: the problem carries over unchanged; the solution gets easier — Azure OpenAI
tool-calling is first-class, no per-model capability worries like Ollama had.

### Reading-experience principles (was: pending todo, ui — mostly superseded)

The v1 "reader polish" todo is moot (v2 UI is built fresh), but its principles are design
input for the new reader: comfortable line length (~60–80 chars), deliberate typography
hierarchy for long-form reading, tuned mark-as-read timing/scroll threshold, a proper close
button, visual cohesion with the rest of the app.

## Deliberately dropped

- **Ollama configuration UI** (DEFERRED #1, was priority high) — obsolete: v2 is
  Azure-only with config-file-based task routing; no provider settings UI exists.
- **UI internationalization** (DEFERRED #2, priority low) — single-user personal app;
  revisit only if that assumption ever changes.
