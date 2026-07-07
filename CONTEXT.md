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
A remembered former category name that deterministically resolves future LLM proposals to a surviving category (or to discard). Created when categories are merged or renamed, and as a discard when a category is deleted; prevents deleted junk from being recreated. Explicitly creating a category with an aliased name overrides the memory.
_Avoid_: synonym list, tombstone

**Proposal**:
The single channel by which the categorization LLM nominates a category name when nothing in the vocabulary fits — at most one per article. Proposals resolve through aliases before anything is created; a surviving proposal becomes a live category flagged for triage.
_Avoid_: suggestion, suggested category

**Category triage**:
Reviewing LLM-created categories after the fact — keep, rename, merge, or block. New categories are live and usable from the moment of creation; triage is cleanup, never an approval gate.
_Avoid_: category approval, moderation queue

**Interests**:
Free prose in which the reader describes what they want to read, fed to the scoring LLM to steer relevance with natural-language nuance a keyword list can't capture.
_Avoid_: keywords, filters, rules

**Anti-interests**:
The counterpart prose describing what the reader wants to see less of. Steers the scoring LLM toward a lower score — distinct from Weight (a per-category stance) and Blocked (absolute suppression), which act on categories, not prose.
_Avoid_: blocklist, mute list, exclusions

**Reader**:
The article reading surface. Full-screen on the phone (the primary device); its desktop presentation (sheet vs. split pane) is a prototype-decided detail. One component tree across breakpoints, never parallel layouts.
_Avoid_: detail view, drawer, article page

**Unread**:
The state of an article the reader hasn't read yet that has been scored and isn't blocked. Unread is a promise of readable, relevant content: articles still awaiting scoring aren't unread *yet*, and blocked articles never are. All unread counts (sidebar badges, list filters) share this single definition, computed by the backend.
_Avoid_: new, unseen, not-read (for anything still in the pipeline)

**Read**:
The state of an article the reader has finished with: visible (scored or rescued) and marked read. The exact counterpart of Unread — blocked articles are never read (they were never unread), and articles still awaiting scoring aren't read yet. Surfaced by an opt-in filter layered on the current scope, never a scope of its own.
_Avoid_: seen, archived, done

**Scope**:
Where the reader is looking: All articles, a single feed, a folder, or the blocked view — one choice at a time, persisted. Distinct from the read filter (Unread vs Read), which layers on top of a scope to choose *which condition* of article to show *within* it. Blocked is a scope, not a filter value, because blocking is system-wide with no per-feed mental model; Read is a filter, not a scope, because it always qualifies a scope you've already chosen.
_Avoid_: view, section, selection (in prose)

**Rating**:
The explicit feedback signal: a single thumbs up or down on an article, available from the list and the reader. Binary by design — no stars, no scales.
_Avoid_: stars, score (that's the LLM's number)

**Feedback event**:
An append-only record of a fact about user behavior, with timestamp. Three types are captured today — rated, marked read, rescued — each emitted on a genuine state transition. `opened` is a reserved-but-unemitted type (deferred); impressions are deliberately not captured (see `docs/adr/0013`). Events record facts only; interpreting them into preference signals is the learning layer's job.
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
