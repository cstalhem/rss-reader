# Feedback capture: mutable rating projection + append-only event log

Feedback is captured in two coupled shapes. The **rating** is a mutable thumbs value on the article (`+1` / `-1` / `NULL`), the current-state projection the UI reads and writes. The **feedback event log** (`feedback_events`) is an append-only ledger of behavioral facts with timestamps, write-only in v2 and consumed only by the future learning layer (#88 out-of-scope; tracked separately). Every rating change writes both: the projection is overwritten, a fact is appended.

Three event types are captured in v2, all emitted on genuine state transitions:

- **`rated`** (`value` = `+1` / `-1` / `NULL`) — every rating change through `PUT /api/articles/{id}/rating`, guarded so a no-op same-value write emits nothing. A clear logs `rated` with `value=NULL` — distinct signal from "never rated", not a silent wipe.
- **`marked_read`** (`value NULL`) — a single-article `is_read` `false→true` transition (reader dwell auto-mark or manual per-row toggle, both via `PATCH /api/articles/{id}`). Mark-all-read and un-read emit nothing.
- **`rescued`** (`value NULL`) — the block→visible transition only (`rescue_article` branch 1). Idempotent retries and no-op replays emit nothing.

`opened` remains in the `FEEDBACK_EVENT_TYPES` allow-list but is **not emitted** in v2 (see Deferrals) — reserving it means the learning layer can start emitting it later with no migration.

## Why

- **Projection + log split**: the UI needs a cheap current-value read ("what did I rate this?"); the learning layer needs the full history ("how did preferences evolve?"). A mutable column answers the first, an append-only log the second. Netflix's stars→thumbs move validated binary-with-history as more honest and more abundant than graded self-reports; a clear is logged as a fact because "I changed my mind" differs from "never engaged."
- **Emit on transition, never on replay**: endpoints are idempotent for safety, but the log records *decisions*. A rescue decision happens once (the block→visible edge); logging retries would double-count one preference signal. The same rule excludes mark-all-read — bulk backlog-clearing is the opposite of engagement and would inject false "read" positives.
- **Append-only enforced app-layer only**: no update/delete route exists; the ORM only ever `INSERT`s events. A DB-level trigger was considered (the table already enforces its value/type invariants at the DB) but deferred as belt-and-suspenders unjustified for a single-user, self-hosted app where every code path is ours.
- **Rating is inert in v2**: it does not affect scoring, filtering, counts, or ordering — pure capture for a consumer that does not exist yet. This is a deliberate scope boundary against "thumbs-down nudges the score" leaking in early.

## Consequences

- No migration for the feedback schema (it ships in the v2 baseline). The only new column is `mark_read_dwell_seconds` on `UserPreferences` — the dwell threshold gating `marked_read` quality, made runtime-tunable (General settings) rather than hardcoded.
- The event log grows monotonically; retention is not addressed (thousands of rows/year is trivial for SQLite).
- Consumer guidance for the learning layer: **order by `id`, not `created_at`** (wall-clock skew); **absence of an event is not a negative** (low-confidence at most); expect **rating sparsity** (most articles never rated); beware the **self-reinforcing filter bubble** (blocked items get no feedback, so the scorer can't learn it was wrong to hide them); feedback is only interpretable relative to the interest-profile version in effect when it was given.

## Deferrals

Deliberately not captured in v2, each addable later without reworking the schema. Tracked in the v2.1 learning-layer issue.

- **Impressions + display position** — the strongest deferral. Without logging what was *shown but not opened*, the learning layer cannot distinguish "rejected" from "never seen" (selection/exposure bias, the most damaging pitfall in log-fed ranking; position bias confounds `opened`). Deferred for volume (impressions dwarf interactions) and category (system-presentation facts, not user behavior); the near-term few-shot path needs positives, not impression-derived negatives. Must be reckoned with when the learning layer is built.
- **`opened`** — descoped from #101 AC #2; lowest-value signal and the only one needing bespoke machinery. Note: the `opened`+`marked_read` pair would have given a facts-only engagement-depth signal (opened-and-bounced vs opened-and-stayed) not confounded by position.
- **Blocked-score-at-rescue** — `rescue_article` NULLs the composite/interest/quality scores before re-queuing, so "what score did the user override?" is irreversibly lost. Recoverable only by snapshotting into a payload before nulling (needs a `payload JSON` column), judged not worth it for the rare rescue event.
- **DB-level append-only trigger**, **event schema-versioning**, **thumbs reason-codes** (contradicts the binary-by-design rating) — all considered, all YAGNI for now.
