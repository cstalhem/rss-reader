# Phase 9: Frontend Codebase Evaluation & Simplification - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Evaluate and simplify the frontend codebase (`frontend/src/`) — hooks, components, state patterns, theme usage, and code organization. Address technical debt accumulated during rapid feature development (Phases 6-8.3) while retaining all functionality. Backend is out of scope.

The specific items listed in ROADMAP.md are a **starting inventory, not an exhaustive list**. Success criteria and best-practice patterns should guide a comprehensive sweep of the entire frontend codebase to find and eliminate anti-patterns, dead code, inefficient implementations, and inconsistencies.

The phase may be split into sub-phases (09, 09.1, etc.) if the research phase reveals more work than fits in one phase. The user wants to review a recommended split after the first research pass.

</domain>

<decisions>
## Implementation Decisions

### Hook & Mutation Patterns

**Mutation return contract:**
- Return mutation objects directly from hooks (not thin wrapper functions)
- Consumers destructure what they need: `.mutate()`, `.isPending`, `.mutateAsync()`
- Rationale: thin wrappers hide useful state (isPending, error) that consumers need for button disabling, inline errors, and action chaining. The existing `createCategoryMutation` exposure in useCategories validates this need.

**Centralized error handling:**
- Implement `MutationCache.onError` as global fallback error toast handler
- Individual mutations can override with their own `onError` when needed (e.g., optimistic rollback)
- Global handler skips mutations that have their own `onError` callback
- Use `meta` tags on mutations for custom error message titles
- This automatically covers hooks with no error handling (useFeedMutations, usePreferences, useOllamaConfig)

**Mutation boilerplate:**
- Keep each useMutation call explicit (no factory/helper abstraction)
- After centralizing error handling, per-mutation config is only ~5-6 lines (mutationFn + onSettled + meta)
- Explicit invalidation is preferable to abstraction that hides cache behavior
- Rationale: TkDodo (TanStack core maintainer) recommends visible invalidation over DRY mutation factories

**Query key factory:**
- Create `lib/queryKeys.ts` with a plain object mapping (no library, no queryOptions)
- Pattern: `queryKeys.categories.all`, `queryKeys.articles.list(filters)`, etc.
- Rationale: queryOptions() adds value when the same query is consumed from multiple places with different options — not our pattern. Each query has exactly one wrapping hook. Centralizing keys eliminates the real problem (inline strings repeated 12+ times).

### Component Deduplication

**Rename logic extraction:**
- Extract `useRenameState` custom hook (not a RenameInput component)
- Hook provides: isRenaming, renameValue, setRenameValue, startRename, handleSubmit, handleCancel, inputRef
- Each component keeps its own render (the 4 implementations differ in visual layout)
- Rationale: share logic via hooks, share UI via components. The rename UIs differ visually.

**Confirmation dialogs:**
- Create general `ConfirmDialog` component with configurable title, body, confirmLabel, onConfirm
- Replace the two inline ungroup dialogs in CategoriesSection
- DeleteCategoryDialog can compose ConfirmDialog as its base (wrapping with category-specific logic)

**Model rows:**
- Extract `ModelRow` component from ModelManagement.tsx
- Handles both curated (has description) and non-curated models via optional prop
- Eliminates ~100 lines of duplicated JSX

**FeedRow input:**
- Replace raw HTML `<input>` with Chakra `Input` component
- Standardize with semantic tokens and theme system (only inline style={{}} in codebase)

### Theme & Token Consistency

**React-icons color pattern:**
- Set `color` on the nearest Chakra parent element, let CSS inheritance flow to SVG `currentColor`
- Where icon is standalone with no parent to piggyback on, wrap in `Box` with `color` prop
- Do NOT create a ThemedIcon wrapper component (over-abstraction)
- Pattern: `<Flex color="fg.muted"><LuFolder size={16} /></Flex>`

**Semantic tokens for hardcoded colors:**
- Create `bg.code` token for code block backgrounds (replaces oklch in ArticleReader)
- Create `fg.success` token (replaces green.600 in AddFeedDialog)
- Create `fg.warning` token (replaces orange.400 in ModelSelector)
- Tokens follow Chakra v3 naming convention: `category.variant`, light/dark aware
- No hardcoded color values anywhere in components — all must reference semantic tokens

**Tooltip standardization:**
- Use `@/components/ui/tooltip` wrapper everywhere (includes Portal, showArrow support)
- Replace raw Tooltip.Root usage in ScoreBadge with the wrapper
- Rationale: wrapper prevents "forgot to add Portal" bugs. Thin composition, no custom logic.

**Dialog Portal pattern:**
- Remove explicit `Portal` wrappers from Dialog components
- Chakra v3 Dialog.Positioner handles portalling internally
- AddFeedDialog pattern (no Portal) is correct; CategoriesSection pattern (explicit Portal) is redundant

**colorPalette context:**
- Set `colorPalette="accent"` per-component, not as global default
- Global default would invert maintenance burden (need to opt-out with colorPalette="gray" on neutral components)
- Fix Sidebar "All Articles" row by adding explicit `colorPalette="accent"` on parent

### Constants & Organization

**Magic number strategy (hybrid):**
- Constants used in 2+ files -> `lib/constants.ts` (e.g., HEADER_HEIGHT, SIDEBAR_WIDTH_*)
- Constants used in 1 file -> named const at top of that file (e.g., AUTO_MARK_READ_DELAY, PAGE_SIZE)
- Rule: shared = centralized, single-use = co-located

**File organization conventions:**
- Types (interface, type) -> `lib/types.ts`
- Runtime utilities (pure functions) -> `lib/utils.ts`
- API client (fetch functions only) -> `lib/api.ts`
- Shared constants (cross-file) -> `lib/constants.ts`
- Query keys -> `lib/queryKeys.ts` (new)
- Fix all current misplacements: ScoringStatus/DownloadStatus to types.ts, parseSortOption to utils.ts, deduplicate API_BASE_URL

**Dead code removal:**
- Delete all confirmed dead files (CategoryRow.tsx, WeightPresets.tsx, SwipeableRow.tsx)
- Remove dead code fragments (redundant filter branch in ArticleList, savedConfig alias in useOllamaConfig)
- Verify DnD package usage with grep before removing from package.json
- Remove unused dependencies only after confirming zero imports remain

### useEffect Cleanup

**Fix all three flagged patterns:**
1. `ArticleReader` optimistic state reset -> use `key={article?.id}` prop (low risk, straightforward)
2. `WeightPresetStrip` prop->state sync -> handle optimism at mutation level, make controlled component (medium risk, ties into optimistic update work)
3. `InterestsSection` server->form sync -> initialize state from server on mount, don't re-sync on refetch, use key prop to reset after save (low-medium risk)

### Broader Sweep Scope

**Extra scrutiny areas (all selected):**
1. **Performance patterns** — unnecessary re-renders, missing React.memo on list items, expensive inline computations, list key quality
2. **Consistency across features** — same patterns used differently across settings sections (loading/error states, mutation invalidation patterns)
3. **Import/export hygiene** — unused exports, circular dependencies, barrel files that defeat tree-shaking
4. **Next.js patterns** — unnecessary "use client" directives, server/client boundary correctness, layout composition

### Knowledge Base (.learning/)

- `.learning/` folder structure being set up (separate task) with atomic files per topic and INDEX.md
- Phase 9 populates these files with findings from the evaluation
- AGENTS.md to be updated with reference to `.learning/` and general best-practice rules as part of Phase 9
- Going forward, agent mistakes and fixes are documented in the relevant `.learning/` topic file

### Claude's Discretion

- How to split Phase 9 into sub-phases if research reveals too much work (present recommendation to user)
- Specific refactoring approach for each useEffect pattern (the direction is locked, implementation details are flexible)
- Whether ArticleRow needs React.memo (evaluate during performance sweep)
- Whether to add `placeholderData: keepPreviousData` to load-more pagination (evaluate during performance sweep)
- Exact structure of `.learning/` topic files (initial scaffold is being set up)

</decisions>

<specifics>
## Specific Ideas

- "I want our codebase to be as clean as possible after this phase" — thoroughness over speed
- File organization conventions should be captured permanently so mistakes aren't repeated
- Agent mistakes should be documented in `.learning/` so they don't recur
- Phase 9 is about the code being *right*, not just *working* — patterns, consistency, and maintainability matter
- User wants to review the sub-phase split recommendation together after the research pass completes

</specifics>

<deferred>
## Deferred Ideas

- **Accessibility audit** — ArticleRow read/unread dot lacks keyboard accessibility (role=button, tabIndex, onKeyDown). Noted for a future accessibility-focused phase rather than piecemeal fixes.
- **Backend codebase evaluation** — This phase is frontend-only. Backend patterns (config, models, API structure) could be evaluated in a future phase.

</deferred>

---

*Phase: 09-frontend-codebase-evaluation-simplification*
*Context gathered: 2026-02-19*
