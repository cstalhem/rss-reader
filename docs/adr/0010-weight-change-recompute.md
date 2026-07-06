# Category weight changes recompute affected articles' composite scores synchronously, preserving interest/quality

Changing a category's weight — via single or bulk `PATCH /categories`, including the triage Block gesture — recomputes `composite_score` and `scoring_state` in the same request transaction for already-scored articles linked to that category, reusing `compute_composite_score()` / `should_block()` over the articles' **stored** `interest_score` and `quality_score`. No LLM call is made, and interest/quality are **preserved**, not zeroed. Previously the PATCH handlers mutated only category rows while the blocked view read a stored `scoring_state` column, so weight changes were forward-only — invisible to any article already scored.

## Why

- **Composite is a pure function of stored interest/quality and current weights**, and `compute_composite_score()` already exists — so the multiplier layer can be re-derived without touching the LLM. Re-running the scoring pipeline (the rejected option) is wrong on principle, not just cost: a weight change does not change the article's interest, only your multiplier. It would also add ~30 s, spend, and nondeterminism to what the UI presents as an instant toggle.
- **Precompute-on-write beats live read-time evaluation.** Weight changes are rare; reads are constant. Keeping `scoring_state`/`composite_score` as stored columns leaves the query layer — `visible_condition()`, `blocked_condition()`, score ordering, rescue semantics — completely untouched. Recomputing at read time would push all of that into live joins over category weights.
- **Preserve, not zero.** Zeroing interest/quality on retroactive block would make the 5-value segmented control asymmetric — sliding to block instant, sliding back costing an LLM call and 30 s. Preserving them makes every transition, including block↔anything, a cheap fully-reversible recompute, which is what the control's affordance promises. The categorization worker still writes zeros when it blocks, because it short-circuits *before* scoring — there are no real scores to preserve there. The worker is not changed.

## Consequences

- **"Blocked" articles become heterogeneous:** worker-blocked ones carry `interest == quality == 0` (never LLM-scored); retroactively-blocked ones carry real preserved scores. On **un**-block, the discriminator `interest == 0 AND quality == 0` routes worker-blocked articles back through the normal pipeline (nothing to recompute from) while everything else takes the cheap recompute; re-scoring a genuinely 0/0 article is harmless.
- The recompute reuses the **rescue-aware** path (`scoring.py`) so rescued articles are never retroactively re-blocked — an ADR-0001-adjacent invariant covered by an explicit test.
- Weight endpoints now have deliberate article side-effects; the grouping endpoint (ADR-0009) deliberately has none. Both invariants are asserted by tests.
- The recompute runs synchronously in the request — a few-thousand-row stored-column update in one SQLite transaction is milliseconds; no background task is introduced.
