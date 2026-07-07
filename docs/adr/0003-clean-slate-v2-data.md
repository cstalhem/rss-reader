# v2 starts with a clean-slate database; no migration path from v1

The v2 schema begins a fresh Alembic chain. v1 data (articles, categories, scores, read state) is not migrated; v1 remains fully preserved at tag `v1.1.2` with its own database.

## Why

The v2 category model (closed vocabulary, aliases, display-only groups, no hidden state) and the feedback event log don't map cleanly onto v1 rows — a migration would spend real effort faithfully porting data the LLM will re-derive anyway (articles re-fetch from feeds, categorization and scoring re-run under the new pipeline). For a single-user RSS reader, historical read-state is not worth a migration project; the feed list is the only thing worth carrying, and re-adding feeds is minutes of one-time work.
