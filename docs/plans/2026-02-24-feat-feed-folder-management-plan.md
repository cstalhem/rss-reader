---
title: feat: Add feed folders for grouped feed management
type: feat
status: completed
date: 2026-02-24
---

# feat: Add feed folders for grouped feed management

## Enhancement Summary

**Deepened on:** 2026-02-24  
**Sections enhanced:** 6  
**Research inputs used:** Local repository analysis, targeted external docs, Context7 documentation lookups (`/fastapi/fastapi`, `/websites/sqlmodel_tiangolo`), and matched quality/security/performance skill guidance.

### Key Improvements

1. Added a concrete case-insensitive folder-name uniqueness strategy backed by database enforcement (not API checks alone).
2. Added explicit unread-count aggregation/query guidance to avoid folder-level N+1 behavior.
3. Added SSR-safe local-storage restore guidance for persisted folder/feed selection.
4. Added mutation invalidation and ordering guardrails to keep sidebar/settings state consistent.
5. Tightened red/green sequencing around the highest-risk backend and UI regression slices.

### New Considerations Discovered

- Folder-name uniqueness should be guaranteed at the DB layer (`lower(name)` unique index or normalized unique column) to eliminate race windows.
- Folder unread badges should come from one grouped query and not per-folder fetches.
- Persisted selection must be validated against current feed/folder existence before triggering article queries.

## ✨ Overview

Add first-class **Feed Folders** so users can organize feeds into named groups (for example: `Engineering`, `News`, `Personal`) while keeping today’s root-level feed flow working unchanged.

This includes:
- Backend support for folder entities and feed-to-folder assignment.
- Grouped rendering in desktop and mobile sidebars.
- Folder-aware feed management in Settings.
- Folder-level article filtering in the main article list.

## Problem Statement / Motivation

Feeds are currently managed as a flat list only, which is hard to scale once users subscribe to many sources. The app already has strong grouping patterns for categories; feed management should provide similar organization ergonomics for administration and day-to-day reading.

## Research Summary

### Section Manifest (Deepen Pass)

- Section 1: Overview + Problem Statement - validate scope boundaries and UX intent.
- Section 2: Proposed Solution - harden schema/API/interaction details and ordering semantics.
- Section 3: System-Wide Impact - stress error propagation, cache invalidation, and lifecycle handling.
- Section 4: Acceptance Criteria + Testing Strategy - tighten measurable outcomes and red/green slices.
- Section 5: Implementation Phases - reinforce execution order and checkpoints.

### Local Repository Findings

- Feed data model is currently flat (`Feed` has no grouping field): `backend/src/backend/models.py:8`.
- Feed APIs support list/create/update/reorder/delete/mark-read but no grouping semantics: `backend/src/backend/routers/feeds.py:24`.
- Article filtering supports `feed_id` only (no folder filter): `backend/src/backend/routers/articles.py:107`.
- Frontend state for feed selection is a single `selectedFeedId` (`number | null`): `frontend/src/components/layout/AppShell.tsx:17`.
- Sidebar and mobile sidebar both assume a flat `feeds.map(...)` list: `frontend/src/components/layout/Sidebar.tsx:193`, `frontend/src/components/layout/MobileSidebar.tsx:134`.
- Feed mutations and cache invalidation are centralized and should be reused for folder operations: `frontend/src/hooks/useFeedMutations.ts:15`.
- Query key conventions are centralized in `queryKeys`: `frontend/src/lib/queryKeys.ts:1`.
- Existing category grouping UX already has reusable patterns for group picking/creation:
  - Root target derivation: `frontend/src/components/settings/CategoriesSection.tsx:73`
  - Group move dialog patterns: `frontend/src/components/settings/MoveToGroupDialog.tsx:15`
  - Search/filter + list presentation pattern to reuse in folder-create feed picker modal.
  - Backend guardrails for grouping constraints: `backend/src/backend/routers/categories.py:213`
- Migration stack uses Alembic with SQLite batch mode (`render_as_batch=True`), so adding nullable columns/new tables fits existing approach: `backend/alembic/env.py:40`.
- Migration tests already validate idempotence and data transforms; same pattern should be followed for feed-folder rollout: `backend/tests/test_migrations.py:157`.

### Institutional Learnings Search (`docs/solutions/`)

- `docs/solutions/` is not present in this repo snapshot (`0` files scanned).
- `docs/solutions/patterns/critical-patterns.md` is also not present.
- Result: no institutional solution docs were available to carry forward.

### External Research Decision

Targeted external research was run because local conventions are strong but there is no existing feed-folder feature to mirror directly.

### External Docs / Best Practices (2026)

- **SQLModel**: nullable foreign keys + `Relationship(back_populates=...)` are the standard pattern for optional parent assignment (`feed.folder_id`): [SQLModel relationship docs](https://sqlmodel.tiangolo.com/tutorial/relationship-attributes/back-populates/).
- **FastAPI**: partial updates should use patch models and apply only provided fields (`exclude_unset`) with explicit `404/409` semantics: [FastAPI partial update docs](https://fastapi.tiangolo.com/tutorial/body-updates/), [FastAPI SQL databases tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/).
- **SQLite**: parent-key usage should be indexed for efficient joins/constraints: [SQLite foreign key docs](https://www.sqlite.org/foreignkeys.html).
- **dnd-kit**: grouped sortable UX should keep keyboard sensor support and use activation constraints to avoid accidental drags: [dnd-kit docs](https://docs.dndkit.com/presets), [dnd-kit accessibility guide](https://docs.dndkit.com/guides).
- **Industry UX references**:
  - Feedly supports organizing sources into folders and moving feeds between folders.
  - FreshRSS supports feed categories/folders for navigation and administration.
  - Sources: [Feedly support](https://docs.feedly.com/article/22-organize-your-feeds), [FreshRSS docs](https://freshrss.github.io/FreshRSS/en/users/03_Main_view.html).

### Deprecation/Sunset Check

- No external API/OAuth/service integration is introduced by this feature.
- Deprecation check result: **not applicable**.

## Proposed Solution

### 1. Backend Data Model and Migration

Add a new folder entity and link feeds to it optionally:

- New table: `feed_folders`
  - `id` (PK)
  - `name` (unique, indexed)
  - `display_order` (int, default `0`)
  - `created_at` (datetime)
- Existing table `feeds`:
  - Add `folder_id: int | None` FK to `feed_folders.id` (`ondelete="SET NULL"`, indexed)
  - Keep existing `display_order` for ordering within a folder (or root-level ungrouped feeds)

Migration requirements:
- Existing feeds remain ungrouped (`folder_id = NULL`).
- Create indexes for `feeds.folder_id` and `feed_folders.display_order`.
- Keep migration idempotent style consistent with existing Alembic patterns.

### backend/src/backend/models.py
```python
class FeedFolder(SQLModel, table=True):
    __tablename__ = "feed_folders"
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now)
    feeds: list["Feed"] = Relationship(back_populates="folder")


class Feed(SQLModel, table=True):
    ...
    folder_id: int | None = Field(
        default=None,
        foreign_key="feed_folders.id",
        ondelete="SET NULL",
        index=True,
    )
    folder: FeedFolder | None = Relationship(back_populates="feeds")
```

### 2. Backend API Surface

Add folder CRUD + ordering endpoints and extend feed/article endpoints:

- New router: `backend/src/backend/routers/feed_folders.py`
  - `GET /api/feed-folders`
  - `POST /api/feed-folders`
  - `PATCH /api/feed-folders/{folder_id}`
  - `DELETE /api/feed-folders/{folder_id}` with deletion mode:
    - default: ungroup feeds (`folder_id=NULL`)
    - optional: delete feeds in folder (`delete_feeds=true`)
  - `PUT /api/feed-folders/order`
- Extend existing feed APIs:
  - `PATCH /api/feeds/{feed_id}` accepts `folder_id` (nullable) in `FeedUpdate`.
  - `PUT /api/feeds/order` becomes folder-aware via payload:
    - `feed_ids: number[]`
    - `folder_id: number | null` (reorders feeds inside that bucket).
- Extend article listing:
  - `GET /api/articles?...&folder_id=<id>` to fetch all articles from feeds assigned to the folder.

Validation rules:
- Folder names unique (case-insensitive normalized comparison at API layer).
- `folder_id` must reference existing folder or be `null`.
- Reorder payload cannot include feeds outside the target folder bucket.
- `POST /api/feed-folders` can accept optional `feed_ids`; all provided feeds must exist and currently be ungrouped (`folder_id IS NULL`).
- Folder create + initial feed assignment runs in one transaction.
- Folder name uniqueness enforces case-insensitive collision prevention (`Programming` and `programming` cannot both exist).

### backend/src/backend/schemas.py
```python
class FeedUpdate(BaseModel):
    title: str | None = None
    display_order: int | None = None
    folder_id: int | None = None


class FeedReorder(BaseModel):
    feed_ids: list[int]
    folder_id: int | None = None


class FeedFolderCreate(BaseModel):
    name: str
    feed_ids: list[int] = []


class FeedFolderDeleteRequest(BaseModel):
    delete_feeds: bool = False
```

### 3. Frontend Data Layer and Types

Update shared types/APIs/hooks while preserving query-key conventions:

- `frontend/src/lib/types.ts`
  - Add `FeedFolder` type.
  - Extend `Feed` with `folder_id`, `folder_name` (or nested folder object).
- `frontend/src/lib/api.ts`
  - Add folder API functions.
  - Extend `updateFeed` payload with `folder_id`.
  - Extend article fetch params with `folder_id`.
- `frontend/src/lib/queryKeys.ts`
  - Add `feedFolders` key namespace.
- New hook:
  - `frontend/src/hooks/useFeedFolders.ts` for folder list + folder mutations.

### 4. Frontend UX and Interaction Model

#### Sidebar + Mobile Sidebar

- Replace flat feed rendering with a root-level mixed list:
  - Folder rows.
  - Ungrouped feed rows (`folder_id = NULL`) as peers.
  - No dedicated `Ungrouped` header/section label.
- Folder rows are collapsible and show child feeds.
- Add selectable folder rows (not only feed rows) to filter article list by folder.
- Folder row displays aggregate unread count for feeds within folder; if total is `0`, hide the badge.
- Keep existing feed row actions (rename, mark read, delete).
- Sidebar drag-and-drop is out of scope in V1; ordering actions in sidebar remain click/menu driven.

#### Create Folder from Main Sidebar

- In the main desktop sidebar header, add a folder-plus icon button adjacent to the existing feed `+` button.
- Clicking folder-plus opens a `CreateFolderDialog` modal with:
  - Folder name input.
  - Checklist of current ungrouped feeds (multi-select) displayed using the categories list pattern (search + selectable row list conventions).
  - Submit action that creates the folder and assigns selected feeds immediately.
- On success:
  - New folder appears in sidebar.
  - Selected feeds move under the new folder.
  - Empty/unchosen checklist is valid (folder-only create).

#### Settings > Feeds

- Use a single unified panel that contains both folders and feeds, styled and structured similarly to the categories section (tree-like grouping in one panel, not separate folder-vs-feed panels).
- In this unified panel:
  - Create/rename/delete/reorder folders.
  - Reorder feeds within each folder and within root-level ungrouped feeds (drag-and-drop enabled here).
  - Bulk move feeds to folder (reuse category move dialog mental model).
- Add move action on feed rows:
  - "Move to folder" picker with create-on-the-fly option.
- Folder delete action opens a confirmation modal with two options:
  - Delete folder and ungroup feeds (default/recommended).
  - Delete folder and delete all feeds in the folder.

#### App Shell Selection State

Replace `selectedFeedId: number | null` with a discriminated union:

### frontend/src/components/layout/AppShell.tsx
```ts
type FeedSelection =
  | { kind: "all" }
  | { kind: "feed"; feedId: number }
  | { kind: "folder"; folderId: number };
```

This removes ambiguity and enables folder-level filtering cleanly.
Persist the last selected folder/feed/all selection in local storage and restore it on reload if it still exists.

### 5. Ordering and Display Semantics

- Folder order:
  - Driven by `feed_folders.display_order`.
- Feed order:
  - Driven by `feeds.display_order` scoped to `folder_id`.
- Root-level ungrouped feeds:
  - `folder_id = NULL`, ordered by `display_order`.
  - Rendered directly at root level (no header).

When moving feed between buckets:
- Assign target `folder_id`.
- Set `display_order` to the current max+1 in target bucket.
- Cross-folder drag is out of scope in V1; feed moves across folders happen via explicit move actions/dialogs.

### 6. Rollout Strategy

1. Land backend schema + API in backward-compatible form.
2. Ship frontend types and selection model.
3. Ship grouped sidebars.
4. Ship settings management flows.
5. Add tests, polish, and accessibility pass.

### Research Insights (Proposed Solution)

**Best Practices:**
- Keep folder-name normalization in API (`strip`, Unicode normalization, `casefold`) and enforce uniqueness in DB; API-only checks can race.
- For case-insensitive uniqueness in SQLite, pick one invariant and document it:
  - unique expression index on `lower(name)` (good fit for this SQLite-first app), or
  - explicit `name_normalized` unique column (more cross-database portability).
- Keep folder create + optional initial feed assignment in one transaction to prevent partial state.

**Performance Considerations:**
- Add a composite index on `feeds(folder_id, display_order)` to optimize bucket rendering and reorder operations.
- Return folder unread aggregates from the folder list query (single grouped query), instead of computing badge counts per folder in separate lookups.
- On successful mutations, invalidate narrowly (`feeds`, `feedFolders`, and affected `articles` queries) to reduce unnecessary refetch churn.

**Implementation Details:**
`backend/alembic/versions/<revision>_feed_folders.py`
```python
# Case-insensitive uniqueness guard for folder names on SQLite.
op.create_index(
    "ux_feed_folders_name_lower",
    "feed_folders",
    [sa.text("lower(name)")],
    unique=True,
)
op.create_index(
    "ix_feeds_folder_id_display_order",
    "feeds",
    ["folder_id", "display_order"],
    unique=False,
)
```

`backend/src/backend/routers/feed_folders.py`
```python
normalized_name = unicodedata.normalize("NFKC", payload.name).strip().casefold()
```

`frontend/src/components/layout/AppShell.tsx`
```ts
// Restore persisted selection only on client and validate references.
useEffect(() => {
  const raw = window.localStorage.getItem("feedSelection");
  if (!raw) return;
  const parsed = safeParseSelection(raw);
  setSelection(validateSelection(parsed, feeds, folders));
}, [feeds, folders]);
```

**Edge Cases:**
- Creating `Programming` when `programming` exists should deterministically return `409`.
- If a selected feed is no longer ungrouped at submit time, folder creation with `feed_ids` should fail atomically with actionable error text.
- Deleting a currently selected folder should immediately fallback selection to `{ kind: "all" }`.

## System-Wide Impact

### Interaction Graph

Flow A: selecting a folder in sidebar  
`Sidebar/MobileSidebar` -> `AppShell` selection state -> `ArticleList` -> `useArticles` -> `fetchArticles(folder_id)` -> `GET /api/articles` with feed join filter -> article query + feed query cache updates.

Flow B: moving a feed into a folder  
`Settings/Sidebar action` -> `updateFeed(folder_id)` mutation -> `PATCH /api/feeds/{id}` -> DB update `feeds.folder_id/display_order` -> invalidate `feeds`, `feedFolders`, `articles` queries -> grouped lists re-render.

Flow C: deleting a folder  
`DeleteFolderConfirmDialog` -> `DELETE /api/feed-folders/{id}` (`delete_feeds=false|true`) -> DB ungroup-or-delete behavior -> cache invalidation -> sidebar/settings reflect resulting state.

Flow D: creating folder from sidebar folder-plus modal  
`Sidebar folder-plus` -> `CreateFolderDialog(name + feed_ids[])` (categories-style selectable list) -> `POST /api/feed-folders` -> DB creates folder + assigns selected ungrouped feeds -> invalidate `feeds`, `feedFolders`, `articles` -> new folder and feed placement rendered.

### Error & Failure Propagation

- Invalid folder assignment (`folder_id` not found):
  - Backend returns `404`.
  - Frontend mutation error handler toasts and reverts optimistic cache.
- Duplicate folder name:
  - Backend returns `409`.
  - Dialog keeps input and shows actionable message.
- Delete folder with `delete_feeds=true`:
  - Backend performs feed + article cascade delete path.
  - Frontend confirms destructive action in modal before request.
- Partial reorder payload mismatch:
  - Backend returns `400`.
  - Frontend triggers refetch to reconcile ordering.
- Network timeout:
  - Mutation error path already centralized by TanStack Query rules and existing mutation meta behavior.

### State Lifecycle Risks

- Risk: feed moved to folder but reorder fails after assignment.  
  Mitigation: execute move + order inside one backend transaction.
- Risk: deleting folder can orphan persisted view state if selected folder disappears.  
  Mitigation: local-storage selection restore validates existence; fallback to `all`.
- Risk: accidental destructive delete when removing folder with `delete_feeds=true`.  
  Mitigation: explicit confirmation option + destructive labeling + default to ungroup.
- Risk: stale UI between desktop/mobile sidebars.  
  Mitigation: both sidebars consume same query keys and invalidation events.

### API Surface Parity

Interfaces requiring synchronized updates:
- Backend routes:
  - `backend/src/backend/routers/feeds.py`
  - `backend/src/backend/routers/articles.py`
  - new `backend/src/backend/routers/feed_folders.py`
- Backend schemas:
  - `backend/src/backend/schemas.py`
- Frontend API/type layers:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/types.ts`
  - `frontend/src/lib/queryKeys.ts`
- Frontend consumers:
  - `frontend/src/components/layout/Sidebar.tsx`
  - `frontend/src/components/layout/MobileSidebar.tsx`
  - `frontend/src/components/article/ArticleList.tsx`
  - `frontend/src/components/settings/FeedsSection.tsx`

### Integration Test Scenarios

1. Create folder from sidebar folder-plus modal with 2 selected ungrouped feeds -> folder is created and selected feeds move under it.
2. Select folder in sidebar -> article list shows only folder feeds; selecting `All Articles` restores full list.
3. Delete folder with default ungroup option -> feeds reappear at sidebar root level without an `Ungrouped` header and remain readable.
4. Delete folder with `delete feeds too` option -> folder feeds (and cascaded articles) are removed from feed/article queries.
5. Reorder feeds within folder in Settings panel -> persisted order survives page reload.
6. Persisted selection restore -> last selected folder reloads correctly; falls back to `All` when folder no longer exists.

### Research Insights (System-Wide Impact)

**Best Practices:**
- Keep mutation handlers idempotent and return canonical changed entities so frontend cache reconciliation is deterministic.
- Keep destructive delete UX explicit: default to ungroup, and require explicit opt-in for `delete feeds too`.

**Performance Considerations:**
- Aggregate unread badge counts in one grouped query (`folder_id -> unread_count`) to avoid per-folder query fan-out.
- Apply folder filtering in SQL joins, not in Python post-processing, to avoid loading non-target feeds/articles.

**Implementation Details:**
`backend/src/backend/routers/feed_folders.py`
```python
unread_expr = func.sum(case((Article.is_read.is_(False), 1), else_=0))
stmt = (
    select(FeedFolder.id, unread_expr.label("unread_count"))
    .join(Feed, Feed.folder_id == FeedFolder.id, isouter=True)
    .join(Article, Article.feed_id == Feed.id, isouter=True)
    .group_by(FeedFolder.id)
)
```

**Edge Cases:**
- Empty folders must render cleanly with no unread badge and no implicit placeholder feeds.
- Reorder APIs should reject mixed-bucket payloads (folder + root IDs) and leave order untouched.
- Persisted invalid selections must not trigger repeated article-query failures.

## SpecFlow Analysis

### User Flow Overview

1. Create folder from main sidebar folder-plus modal and optionally select ungrouped feeds to include.
2. Move one or many feeds to a folder.
3. Select folder in sidebar to focus article reading.
4. Reorder folders and feeds in Settings panel for navigation priority (no sidebar drag).
5. Delete folder using confirmation options (ungroup feeds by default, or delete feeds too).

### Flow Permutations Matrix

| Flow | Desktop | Mobile | First-time user | Returning user |
|---|---|---|---|---|
| Create folder | Main sidebar folder-plus modal (name + ungrouped feed checklist) | Settings drawer/page (fallback) | Guided empty state | Quick-add action |
| Move feed | Context menu + dialog | Swipe/context action + dialog | Single-feed move | Bulk move |
| Select folder | Sidebar section | Mobile drawer section | Starts at All | Restores last selection |
| Reorder | Settings panel drag handles (within folder/root only) | Settings page drag handles (within folder/root only) | N/A | Frequent |
| Delete folder | Confirm dialog | Confirm dialog | Rare | Recovery flow |

### Resolved Product Decisions

- Deleting a folder defaults to ungrouping feeds, with an explicit destructive option in confirmation modal to delete feeds too.
- Folder names are unique case-insensitively (`Programming` and `programming` are treated as conflicts).
- Last selected folder/feed/all view is persisted in local storage and validated on load.
- Cross-folder drag is not supported in V1; reorder is only within folder/root groups.
- Folder rows display aggregate unread badge only when count is greater than zero.

### Recommended Next Steps

- Implement red/green TDD for backend folder API behavior first.
- Implement backend schema + API first, then frontend state migration.
- Validate with integration tests before UI polish.

## Acceptance Criteria

### Functional Requirements

- [x] Users can create, rename, reorder, and delete feed folders.
- [x] Main sidebar includes a folder-plus action next to feed add; it opens a create-folder modal with folder name and ungrouped-feed checklist.
- [x] Folder creation can optionally assign selected ungrouped feeds in the same flow.
- [x] Users can assign/unassign feeds to folders from settings and sidebar actions.
- [x] Sidebar (desktop + mobile) renders ungrouped feeds at root level as peers to folder rows, with no `Ungrouped` header.
- [x] Sidebar folder rows display aggregate unread count for child feeds and hide the badge when count is `0`.
- [x] Users can select a folder to filter articles to feeds in that folder.
- [x] Folder delete confirmation provides both actions: default ungroup feeds, optional destructive `delete feeds too`.
- [x] Folder name uniqueness is case-insensitive.
- [x] Last selected folder/feed/all selection persists in local storage and gracefully falls back when missing.
- [x] Settings page uses one unified folders+feeds panel (categories-style structure), not separate folder/feeds panels.
- [x] Existing feed behavior remains intact for users who never create folders.

### Non-Functional Requirements

- [x] Feed and folder list interactions remain keyboard accessible.
- [x] Drag interactions keep accidental-drag protection (`activationConstraint`) in Settings page reorder flows.
- [x] Sidebar does not rely on drag-and-drop semantics in V1.
- [x] No N+1 query regressions in folder-filtered article listing.
- [x] API latency for `GET /api/feeds` and `GET /api/feed-folders` remains acceptable for typical local datasets.

### Quality Gates

- [x] Backend tests added for folder CRUD, assignment, reorder, delete behavior.
- [x] Frontend tests added for grouped rendering and selection transitions.
- [x] Migration tests added for new table/column creation and idempotence.
- [x] Red/green TDD workflow is used for relevant automated-testable behavior (write failing tests first, then implementation, then pass).
- [ ] `uv run pytest`, `uv run ruff check .`, and `bun run lint` pass.

## Testing Strategy (Red/Green TDD)

Use red/green cycles for all automated-testable behavior:

1. **Red**: add/extend failing tests for one behavior slice.
2. **Green**: implement the minimum code to pass.
3. **Refactor**: clean up without changing behavior; keep tests green.

Priority slices for TDD:

- Backend API:
  - Case-insensitive folder name uniqueness collisions.
  - Folder create with optional ungrouped `feed_ids`.
  - Folder delete default ungroup behavior.
  - Folder delete destructive `delete_feeds=true` behavior.
  - Reorder constraints (within-folder/root only).
- Frontend behavior:
  - Sidebar root-level rendering with no `Ungrouped` header.
  - Folder unread badge visibility (`>0` shows, `0` hides).
  - Local-storage persistence and fallback for selection state.
  - Create-folder modal feed list behavior using categories-style search/selection conventions.

### Research Insights (TDD Hardening)

**Best Practices:**
- Keep backend tests integration-first with real SQLite fixtures (aligned with existing project testing principles).
- Keep frontend automated coverage focused on behavior-bearing assertions instead of broad snapshots.

**Performance/Regression Checks:**
- Add one API regression test for folder unread-count aggregation path to catch accidental N+1 query reintroduction.
- Add one reorder regression test ensuring folder reorder calls do not mutate root-level order.

**Implementation Details:**
- Suggested red/green order:
  1. Folder name uniqueness and transactional create-with-feed assignment.
  2. Folder delete policy variants (`ungroup` default vs `delete feeds too`).
  3. Reorder guardrails (within bucket only).
  4. Sidebar root rendering + unread badge visibility behavior.
  5. Persisted selection restore + fallback behavior.
  6. Create-folder modal assignment flow.

## Success Metrics

- Folder actions complete without errors in manual smoke runs.
- Users can locate/manage feeds faster with grouped navigation.
- No regressions in existing feed add/remove/rename/read flows.

## Dependencies & Risks

- **Dependency**: Alembic migration must be applied cleanly on existing SQLite databases.
- **Dependency**: Frontend selection-state refactor touches multiple components at once.
- **Risk**: inconsistent ordering after moves.  
  Mitigation: transactionally set target folder and display order.
- **Risk**: duplicate folder names.  
  Mitigation: API-level normalization + DB uniqueness.

## Implementation Phases

### Phase 1: Data Model + API Foundation

- [x] Add `FeedFolder` model and `Feed.folder_id` relation in `backend/src/backend/models.py`.
- [x] Add folder schemas in `backend/src/backend/schemas.py`.
- [x] Add folder router `backend/src/backend/routers/feed_folders.py`.
- [x] Extend feeds/articles routers for folder assignment and filtering.
- [x] Support `POST /api/feed-folders` with optional `feed_ids` for transactional initial assignment of ungrouped feeds.
- [x] Support folder delete mode (`delete_feeds=false|true`) with default ungroup behavior.
- [x] Enforce case-insensitive folder name uniqueness in API validation and persistence path.
- [x] Register router in `backend/src/backend/main.py`.
- [x] Add migration file `backend/alembic/versions/<revision>_feed_folders.py`.

### Phase 2: Frontend Data/State Refactor

- [x] Extend types and API clients in `frontend/src/lib/types.ts` and `frontend/src/lib/api.ts`.
- [x] Add `queryKeys.feedFolders` in `frontend/src/lib/queryKeys.ts`.
- [x] Add `useFeedFolders` hook in `frontend/src/hooks/useFeedFolders.ts`.
- [x] Replace `selectedFeedId` with discriminated selection state in `frontend/src/components/layout/AppShell.tsx`.
- [x] Persist selection state in local storage and restore with existence validation fallback.

### Phase 3: UX Integration

- [x] Implement grouped sidebar rendering in `frontend/src/components/layout/Sidebar.tsx` with no `Ungrouped` header (root-level peers) and no sidebar drag-and-drop.
- [x] Implement grouped mobile rendering in `frontend/src/components/layout/MobileSidebar.tsx`.
- [x] Update `frontend/src/components/article/ArticleList.tsx` for folder filter path.
- [x] Implement one unified folders+feeds settings panel in `frontend/src/components/settings/FeedsSection.tsx` (categories-style grouping, not separate panels).
- [x] Add folder-plus icon action next to existing add-feed icon in main sidebar header.
- [x] Add `CreateFolderDialog` for name + ungrouped-feed checklist (borrowing categories list/search pattern) and wire it to folder create API.
- [x] Add delete-folder confirmation modal with explicit ungroup-vs-delete-feeds options.
- [x] Add move-to-folder dialog `frontend/src/components/feed/MoveToFolderDialog.tsx`.

### Phase 4: Validation and Hardening

- [x] Apply red/green TDD cycle for backend folder API behaviors before implementation merge.
- [x] Add backend API tests in `backend/tests/test_feed_folders_api.py`.
- [x] Add migration tests in `backend/tests/test_migrations.py`.
- [x] Add frontend interaction tests in `frontend/src/components/layout/__tests__/sidebar-folders.test.tsx`.
- [x] Add frontend tests for unread folder badge semantics and local-storage selection persistence behavior.
- [ ] Run lint/tests and complete manual desktop/mobile smoke pass.

### Research-Informed Sequencing Notes

- Add a migration checkpoint immediately after Phase 1 on a copy of an existing local DB: create folder, assign feeds, ungroup via folder delete.
- Gate Phase 3 (UI integration) on passing backend contract tests to minimize frontend churn from API-shape corrections.
- Keep rollback straightforward: backend remains backward-compatible while folder UI can be conditionally hidden if a late UX regression appears.

## ERD (New Model Change)

```mermaid
erDiagram
    FEED_FOLDERS ||--o{ FEEDS : contains
    FEEDS ||--o{ ARTICLES : publishes

    FEED_FOLDERS {
      int id PK
      string name UNIQUE
      int display_order
      datetime created_at
    }

    FEEDS {
      int id PK
      string url UNIQUE
      string title
      int display_order
      int folder_id FK NULL
      datetime last_fetched_at
    }

    ARTICLES {
      int id PK
      int feed_id FK
      string title
      string url UNIQUE
      bool is_read
      float composite_score
      string scoring_state
    }
```

## AI-Era Considerations

- Use AI assistance for boilerplate generation (schemas/types/router scaffolding), but require human review for:
  - Migration safety.
  - Ordering logic correctness.
  - Selection-state transitions.
- Prioritize integration tests because rapid AI-assisted edits can miss cross-layer regressions.

## Sources & References

### Internal References

- Feed model and flat structure: `backend/src/backend/models.py:8`
- Feed API surface: `backend/src/backend/routers/feeds.py:24`
- Article feed filter point: `backend/src/backend/routers/articles.py:107`
- Category grouping backend guardrails: `backend/src/backend/routers/categories.py:213`
- Sidebar flat rendering: `frontend/src/components/layout/Sidebar.tsx:193`
- Mobile sidebar flat rendering: `frontend/src/components/layout/MobileSidebar.tsx:134`
- Selection state currently feed-only: `frontend/src/components/layout/AppShell.tsx:17`
- Feed mutation invalidation patterns: `frontend/src/hooks/useFeedMutations.ts:15`
- Query key conventions: `frontend/src/lib/queryKeys.ts:1`
- Category move dialog UX pattern: `frontend/src/components/settings/MoveToGroupDialog.tsx:15`
- Alembic SQLite batch mode: `backend/alembic/env.py:40`
- Migration test style/idempotence: `backend/tests/test_migrations.py:157`
- Backend rules: `.claude/rules/backend.md:9`
- Frontend rules: `.claude/rules/frontend.md:34`

### External References

- SQLModel relationships: <https://sqlmodel.tiangolo.com/tutorial/relationship-attributes/back-populates/>
- FastAPI body updates (PATCH): <https://fastapi.tiangolo.com/tutorial/body-updates/>
- FastAPI SQL databases tutorial: <https://fastapi.tiangolo.com/tutorial/sql-databases/>
- SQLite foreign keys and indexing: <https://www.sqlite.org/foreignkeys.html>
- SQLite indexes on expressions: <https://www.sqlite.org/expridx.html>
- SQLite CREATE INDEX reference: <https://www.sqlite.org/lang_createindex.html>
- SQLite collating sequences (`NOCASE`): <https://www.sqlite.org/datatype3.html#collating_sequences>
- dnd-kit presets and sensors: <https://docs.dndkit.com/presets>
- dnd-kit accessibility guidance: <https://docs.dndkit.com/guides>
- TanStack Query invalidation from mutations: <https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation>
- Next.js hydration mismatch guidance: <https://nextjs.org/docs/messages/react-hydration-error>
- WAI-ARIA modal dialog pattern: <https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/>
- Feedly folder organization reference: <https://docs.feedly.com/article/22-organize-your-feeds>
- FreshRSS navigation/category reference: <https://freshrss.github.io/FreshRSS/en/users/03_Main_view.html>

### Related Work

- Related issues: none documented yet.
- Related PRs: none documented yet.
