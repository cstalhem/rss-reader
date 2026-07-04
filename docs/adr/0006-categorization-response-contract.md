# The categorization response contract is a per-batch schema: display-name enums plus one nullable proposal field

The categorization response schema is built dynamically per batch by a schema factory. Assignment is `categories: list[Literal[...]]` where the enum members are the display names of every category in the vocabulary — strict structured outputs make out-of-vocabulary assignment impossible at generation time, which is the enforcement mechanism ADR-0001 requires. The proposal channel is a single `proposed_category: str | None` field; `null` is the structural default, framing proposal as the exception path.

## Why

- **Display names over slugs or IDs**: the model semantically matches article content against human-readable strings; strict mode guarantees the emitted string is verbatim from the enum, so the slug lookup on our side can never miss. IDs would force the model to cross-reference a legend — the same hallucination-shaped indirection the closed vocabulary removes.
- **One proposal, not a list**: vocabulary growth should be deliberate (one new category per article per pass). An article about two novel topics self-heals — the second topic recurs and gets proposed later. The scalar shape structurally reinforces the "only when nothing fits" rule.
- **Prompt-enforced limits**: strict mode rejects constraint keywords like `maxItems`, so the 1–4 categories-per-article limit stays in the prompt with worker-side clamping. Schemas stay free of constraint keywords.

## Consequences

- **Empty vocabulary degrades, never deadlocks**: `Literal` with zero members is untypable, so when the vocabulary is empty the factory falls back to `categories: list[str]` for that batch. The worker's name→category mapping drops and logs any lookup miss unconditionally — creation flows only through the proposal ladder (active match → alias → create-or-discard), so the fallback can mislabel nothing and create nothing. Proposals bootstrap the vocabulary back within a few batches. Parking the queue instead was rejected as a silent deadlock.
- Drop-on-miss doubles as defense-in-depth if strict mode ever leaks an out-of-enum string: worst case is a dropped label, never a created category.
- Groups are never serialized into the categorization prompt and the response carries no parent suggestion (ADR-0001) — new categories are born ungrouped; shelving belongs to auto-grouping and triage.
- The schema changes with the vocabulary, so canned test responses must be validated through the schema the worker hands the mocked wrapper — which makes every worker test also a test of the enum.
