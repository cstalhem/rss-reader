# RSS Reader

A single-user, self-hosted RSS reader that uses LLM scoring to hide noise, surface relevant articles, and occasionally deliver serendipitous finds.

## Language

**Group**:
A display-only shelf that organizes categories in the sidebar, assigned manually or by LLM auto-grouping. Carries no scoring semantics and never appears in the categorization vocabulary — regrouping can never change what gets filtered.
_Avoid_: parent category, hierarchy

**Weight**:
The user's per-category stance on how much a category should count toward relevance: block, reduce, normal, boost, or max. The only suppression mechanism — there is no separate "hidden" state.
_Avoid_: hidden, category priority

**Blocked**:
The absolute weight: an article carrying any blocked category scores zero, skips the scoring LLM, and remains inspectable in the blocked view. Blocking suppresses articles, never labels — blocked categories stay in the vocabulary so filtering stays auditable.
_Avoid_: hidden, banned, excluded

**Alias**:
A remembered former category name that deterministically resolves future LLM proposals to a surviving category (or to discard). Created when categories are merged or renamed; prevents deleted junk from being recreated.
_Avoid_: synonym list, tombstone

**Category triage**:
Reviewing LLM-created categories after the fact — keep, rename, merge, or suppress. New categories are live and usable from the moment of creation; triage is cleanup, never a approval gate.
_Avoid_: category approval, moderation queue

**Reader**:
The article reading surface. Full-screen on the phone (the primary device); its desktop presentation (sheet vs. split pane) is a prototype-decided detail. One component tree across breakpoints, never parallel layouts.
_Avoid_: detail view, drawer, article page

**Rating**:
The explicit feedback signal: a single thumbs up or down on an article, available from the list and the reader. Binary by design — no stars, no scales.
_Avoid_: stars, score (that's the LLM's number)

**Feedback event**:
An append-only record of a fact about user behavior (opened, marked read, rated, rescued), with timestamp. Events record facts only; interpreting them into preference signals is the learning layer's job.
_Avoid_: engagement metric, analytics

**Rescue**:
Retrieving an article from the blocked view back into visibility — the strongest available signal that filtering was wrong.
_Avoid_: unblock, restore

**Aggregator feed**:
A feed whose entries point at external articles instead of carrying their own content (e.g., Hacker News, Lobsters). Declared by the user when the feed is added — never auto-detected.
_Avoid_: linker feed, link feed

**Fetch-through**:
Resolving an aggregator feed entry to its linked article's extracted content, so categorization and scoring see the real substance instead of bare RSS metadata.
_Avoid_: reach-through, link resolution, linked-content fetching
