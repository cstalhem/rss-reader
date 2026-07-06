# Category grouping is one endpoint with explicit modes, not field-level parent edits

Assigning categories to display-only group shelves (ADR-0001) gets a single dedicated endpoint `POST /api/categories/group`, taking `category_ids` plus exactly one explicit mode: `target_parent_id` (assign to an existing shelf), `new_parent_name` (create the shelf and assign members in one transaction), or `ungroup: true` (detach the given categories to root). It replaces three provisional endpoints kept alive by #91 — `POST /categories/batch-move`, `POST /categories/{id}/ungroup`, and `POST /categories/mark-seen`. Bulk `PATCH /categories` continues to exclude `parent_id`: grouping is an operation with its own verb, not a field edit.

## Why

- **Atomic create-and-assign closes the orphan hole.** "Name a new group and put these categories in it" was otherwise two non-atomic calls (`POST /categories` then move); a failure between them leaves an empty orphan shelf. The alternative fix — client-side compensation on failure — is more total code, lives in the wrong layer, and sits on a path that never runs until it matters. One endpoint with a transaction boundary is the simpler system.
- **Explicit mutually-exclusive modes make omission safe.** Exactly one of `target_parent_id | new_parent_name | ungroup` is required and schema-validated, so a client that forgets a field gets a 422 rather than silently detaching categories from their groups. Absence of input never means a destructive default. This also retires the `-1` parent sentinel — a REST smell not worth carrying forward.
- **One assignment path enforces the one-level invariant.** A shared `assign_to_parent()` session helper (target must be root, no grandchildren per ADR-0001) backs both this endpoint and `auto-group/apply`, so the invariant can't drift between two copies of the rule.
- **`mark-seen` was a strict duplicate** of bulk `PATCH {needs_triage: false}` — no capability the bulk path lacks — so it folds away rather than surviving as a v1-shaped wrapper.

## Consequences

- This is **not** a reversal of #91's exclusion of `parent_id` from bulk PATCH — it upholds it. Field edits (weight, triage state) stay on PATCH; grouping is a distinct operation with a distinct verb.
- The grouping endpoint has **no article side-effects** — groups are display-only and never affect scoring or filtering (ADR-0001). A test asserts it never touches `scoring_state` or `composite_score`; that guard is the cheapest defense against a future change making groups affect scoring.
- "Ungroup all" for a shelf is the client calling `ungroup: true` with the shelf's child ids (already in hand from the category listing) — acceptable for a single-user app, and it means no server-side parent→children lookup endpoint is needed.
