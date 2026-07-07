# Fetch-through runs as a best-effort, worker-level step with cached results

Aggregator feed entries carry only a title and an outbound link (ADR context: PRD #88), so the pipeline scored them blind. Fetch-through resolves the linked article's content before categorization and scoring. We implement it as a shared, **best-effort** helper — `ensure_linked_content(session, article, feed)` in `fetch_through.py` — called just-in-time by *both* the categorization worker and the scoring worker, rather than at ingest or as a new pipeline state. The scoring worker must call it too because the `score_only` rescore path skips categorization entirely and would otherwise score aggregator articles on bare RSS metadata.

Extracted content and a last-attempt timestamp are persisted on the article (`linked_content_markdown`, `linked_fetched_at`), leaving the RSS columns intact so fallback always has something to use. The helper's check order is load-bearing: cache-hit (`linked_content_markdown` present) short-circuits *before* the `linked_fetched_at` guard, so rescore entry points can clear `linked_fetched_at` unconditionally — a prior success is never re-fetched (satisfying "cache prevents re-fetch on rescore"), while a prior failure re-attempts. Within a single categorize→score pass the un-cleared timestamp prevents a dead link being fetched twice.

## Consequences

- **Fetch failure must be invisible to the retry state machine.** The helper catches everything (network, HTTP status, content-type, size, empty/short extraction), logs a warning, stamps `linked_fetched_at`, and returns `str | None` — it *never* raises into the worker. A fetch failure costs zero categorization/scoring attempts; conflating it with `LLMCallFailed` would eventually mark the article `failed` and violate "the article is never stuck." As defense-in-depth the worker `try:` is widened to cover the content-prep loop so a helper bug degrades to a counted retry, not a stranded batch (see `.claude/rules/backend.md` on batches stuck in `categorizing`/`scoring`).
- **The fetch happens outside any write transaction** (up to ~10s of network I/O); results persist via a short commit, matching the existing three-commit worker discipline.
- Workers batch-load `Feed` rows once per batch (an `IN` query, mirroring the category pre-load) — there is no `Article.feed` relationship, so a naive per-article `session.get(Feed)` would be an N+1.
- Toggling `is_aggregator` on an existing feed is future-only: the fetch decision is gated on `is_aggregator AND linked_fetched_at IS NULL`, but content *selection* always prefers `linked_content_markdown` when present. Backlog is picked up only by an explicit rescore, never a flag-triggered bulk fetch.
- Outbound fetches use an app-owned async `httpx` client (lazy singleton, closed in the lifespan) with a small in-memory per-host interval limiter (5s, matching trafilatura's `SLEEP_TIME` default), scoped to fetch-through only — not shared with feed refresh.

## Considered options

- **Fetch at ingest (`feeds.py` refresh):** rejected — feed refresh is serial per feed, so 30 slow external fetches would stall the whole refresh job.
- **A dedicated retryable pipeline stage/state:** rejected — fetch failure is deliberately non-fatal, so it must not participate in the retry state machine; a new state adds machinery for retries we explicitly don't want.
- **`courlan.UrlStore` (trafilatura's own throttling engine):** rejected — it is a crawler-scale URL-queue scheduler and sync; overkill and paradigm-mismatched for JIT small-batch fetching in an async worker.
