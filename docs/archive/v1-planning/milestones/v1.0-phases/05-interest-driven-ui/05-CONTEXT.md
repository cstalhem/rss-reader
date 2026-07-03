# Phase 5: Interest-Driven UI - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual presentation of articles by LLM-scored relevance. Users see interest scores on article rows, can sort/filter by different criteria, and high-interest articles are visually prominent. This phase adds sorting controls, score indicators, and filter tabs for scoring/blocked states. It does NOT add new scoring logic, categories, or feed management features.

</domain>

<decisions>
## Implementation Decisions

### Score Presentation
- All tiers show a **numeric score badge** on the right side of each article row (same component, different styling per tier)
- **High (>=15)**: accent-colored (orange) badge
- **Medium (>=8, <15)**: default/neutral badge
- **Low (<8)**: muted/gray badge
- **Moderate prominence** — noticeable at a glance when scanning, but title is still primary
- Hover tooltip shows exact score (e.g., "Score: 14.2")
- Reader panel also displays exact score
- Score precision (decimal vs integer) is Claude's discretion

### Sort Controls
- **Default sort**: composite_score descending, with oldest-first tiebreaker for equal scores
- **4 sort options** in dropdown: Highest score, Lowest score, Newest first, Oldest first
- **Chakra custom select** (not native) — matches dark theme and design system
- Dropdown shows selected label + directional arrow icon
- **Placement**: top bar, near existing read/unread filter toggle
- **Sort persistence**: stored in localStorage, persists across sessions and feed switches (global preference)
- Switching to date sort still shows score badges — they coexist

### Unscored Article Handling
- Unscored articles live in a **separate "Scoring" filter tab** alongside Unread and All Articles
- Filter bar becomes: **Unread (N) | All (N) | Scoring (N) | Blocked (N)**
- Scoring tab count **only shown when non-zero**; button **disabled when 0** unscored articles
- In the scoring tab, articles show **distinct states**: pulsing dot for queued, spinner for actively scoring
- When scoring completes, article briefly shows a **"scored" indicator** before moving to the main view on next poll refresh
- Articles reorder on next polling refresh (no live animation)
- **Fallback when all unscored / Ollama down**: info banner with actual error messages, articles sorted by date (oldest first)

### Blocked Article Handling
- Blocked-category articles are **hidden from main views** (Unread, All Articles)
- Accessible via a dedicated **"Blocked" filter tab** — same behavior as Scoring tab (count when non-zero, disabled when 0)
- Allows user to review what's being filtered out

### Visual Hierarchy
- **High-scored rows (>=15)** get a very subtle accent (orange) background tint (~2-3% opacity)
- Medium and low rows have **no row tinting** — badge color alone differentiates
- **No section headers or grouping** — flat sorted list with badges providing visual hierarchy
- **Existing read/unread indicators unchanged** (opacity + orange dot coexist with score badges)
- Same visual behavior in all views (all articles, single feed)
- Sort dropdown handles "classic mode" — switching to Newest first gives chronological view without needing a separate toggle

### Claude's Discretion
- Exact score precision format (one decimal vs integer)
- Divider style between scored and unscored sections within scoring tab
- Exact disabled button styling for scoring/blocked tabs
- Duration of "scored" indicator before article moves to main view
- Exact accent tint CSS implementation (rgba overlay vs background color token)

</decisions>

<specifics>
## Specific Ideas

- Filter bar tabs inspired by existing Unread/All toggle pattern — extend it rather than redesign
- "Scoring" and "Blocked" tabs are contextual — they appear/enable only when relevant
- The sort dropdown should feel native to the app's dark theme (Chakra Select, not NativeSelect)
- Oldest-first tiebreaker for score sort reflects a "catch up" reading workflow

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-interest-driven-ui*
*Context gathered: 2026-02-13*
