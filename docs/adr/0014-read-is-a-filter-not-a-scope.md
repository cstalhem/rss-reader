# Read is a filter, not a scope

## Context

The v2 article list was hardcoded to unread-only. Adding a "view read articles" mode (issue #125) raised the question of how to model read-state relative to the existing `FeedSelection` scope (`all | feed | folder | blocked`).

## Decision

Read-state is an **orthogonal filter** (`ReadFilter = "unread" | "read"`) layered on top of whichever scope is selected — not a fifth `FeedSelection` variant. The filter is threaded into the article query key (`articles.list(selection, filter)`) so read and unread lists cache independently, and it derives the sort (unread → `composite_score desc`, read → `published_at desc`).

## Considered Options

- **Read as a scope variant** (mirroring `blocked`): rejected. `blocked` earns its place as a scope because blocking is inherently system-wide — there is no "blocked articles of one feed" mental model. Read is the opposite: you always want read articles *for a scope you have already chosen* (issue #125's acceptance criterion is "for a selected feed/folder"). Folding read into `FeedSelection` would discard the feed/folder context at the exact moment it is needed, and would create combinatorial scope values (`read-feed-5`, `read-folder-3`).
- **Read as an orthogonal filter** (chosen): scope answers "where am I looking," read-state answers "which condition of article." Orthogonal concerns, orthogonal state.

## Consequences

- The read population is the mirror of unread — `read_condition()` = visible (scored or rescued) AND `is_read` — so blocked-but-opened articles never appear in the read view; they stay in the blocked view only.
- The filter is ephemeral shell state (not persisted): every fresh load starts unread-first, honoring the unread-first default (PRD story #8), while the mode carries across scope changes within a session.
- The `useArticles` pagination offset generalizes to "count of cached items still matching the active filter," covering both filters with one rule. The `blocked` view keeps its own hook because it paginates via full invalidation (rescue), not surgical cache edits.
- See CONTEXT.md entries **Read** and **Scope**.
