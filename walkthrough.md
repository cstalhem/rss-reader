# Auto-Group Categories by LLM — Code Walkthrough

*2026-03-04T07:49:48Z by Showboat 0.6.1*
<!-- showboat-id: 5167dd1f-2a7e-4449-a66f-7d4c60ffa2d3 -->

This walkthrough explains the implementation of **Issue #27: Auto-Group Categories by LLM**. The feature adds a button to the Categories settings page that asks an LLM to analyze all categories and suggest parent-child groupings. The user previews the suggestions in a dialog, then confirms to apply them.

## Architecture Overview

The feature follows a **suggest-then-apply** pattern:

1. **Suggest** (read-only) — Frontend opens a dialog, calls `POST /api/categories/auto-group/suggest`. The backend loads all categories, builds a prompt, calls the LLM, validates the response, and returns suggested groupings. No database writes.
2. **Apply** (write) — User reviews the preview and clicks Apply. Frontend calls `POST /api/categories/auto-group/apply` with the confirmed groups. The backend flattens all existing parent-child relationships, then applies the new groupings.

This two-phase design keeps the LLM interaction idempotent and safe — you can suggest multiple times without side effects.

---

## 1. Backend: Prompts Package Refactor

The first change was structural. The monolithic `prompts.py` (handling both categorization and scoring schemas) was split into a `prompts/` package with separate modules. The `__init__.py` re-exports everything for backward compatibility.

```bash
ls backend/src/backend/prompts/
```

```output
__init__.py
__pycache__
categorization.py
grouping.py
scoring.py
```

The `__init__.py` re-exports all public names so that existing imports like `from backend.prompts import CategoryResponse` continue to work unchanged:

```bash
cat backend/src/backend/prompts/__init__.py
```

```output
"""LLM prompt templates and response schemas for content curation.

Re-exports all public names for backward compatibility.
"""

from backend.prompts.categorization import (
    DEFAULT_CATEGORY_HIERARCHY,
    CategoryResponse,
    build_categorization_prompt,
)
from backend.prompts.grouping import (
    GroupingResponse,
    GroupSuggestion,
    build_grouping_prompt,
)
from backend.prompts.scoring import (
    ScoringResponse,
    build_scoring_prompt,
)

__all__ = [
    "CategoryResponse",
    "DEFAULT_CATEGORY_HIERARCHY",
    "GroupSuggestion",
    "GroupingResponse",
    "ScoringResponse",
    "build_categorization_prompt",
    "build_grouping_prompt",
    "build_scoring_prompt",
]
```

We can verify the refactor is backward-compatible — all 81 pre-existing tests still import from `backend.prompts` and pass:

```bash
cd backend && uv run pytest tests/test_scoring.py -q 2>&1 | tail -3
```

```output
...............                                                          [100%]
15 passed in 0.02s
```

---

## 2. The Grouping Prompt & Schema

The new `prompts/grouping.py` defines the LLM contract. Two Pydantic models describe the structured output the LLM must return, and a prompt builder function constructs the instruction text.

The key design decisions:
- **`GroupSuggestion`** uses `min_length=1` on children — the LLM cannot suggest empty groups.
- **`GroupingResponse`** defaults to an empty list — if the LLM finds no meaningful groupings, it returns `{"groups": []}`.
- The prompt explicitly lists rules: only use existing names, broader categories as parents, no nested groups, no forced groupings.

```bash
cat backend/src/backend/prompts/grouping.py
```

```output
"""LLM prompt templates and response schemas for category grouping."""

from pydantic import BaseModel, Field


class GroupSuggestion(BaseModel):
    parent: str = Field(description="Existing category name to use as group parent")
    children: list[str] = Field(
        description="Existing category names to place under this parent", min_length=1
    )


class GroupingResponse(BaseModel):
    groups: list[GroupSuggestion] = Field(
        default=[], description="Suggested groupings"
    )


def build_grouping_prompt(
    all_categories: list[str],
    existing_groups: dict[str, list[str]],
) -> str:
    """Build prompt for LLM-based category grouping suggestions.

    Args:
        all_categories: All non-hidden category display names
        existing_groups: Current parent->children mapping for context

    Returns:
        Prompt string for grouping
    """
    categories_list = "\n".join(f"- {name}" for name in sorted(all_categories))

    existing_section = ""
    if existing_groups:
        group_lines = []
        for parent, children in sorted(existing_groups.items()):
            children_str = ", ".join(children)
            group_lines.append(f"  {parent} > {children_str}")
        existing_section = f"""

**Current groups (for context):**
{chr(10).join(group_lines)}
"""

    return f"""Group these categories into logical parent-child relationships.

**All categories:**
{categories_list}
{existing_section}
**Rules (follow strictly):**
1. ONLY use the provided category names exactly as written. Do NOT create new categories.
2. Use broader categories as parents and narrower ones as children.
3. Each group must have at least one child.
4. Categories that do not fit any group should remain unparented — do NOT force groupings.
5. No nested groups — only one level of parent-child.

Group these categories now."""
```

Here's what the prompt looks like with real data — notice how existing groups are included as context for the LLM:

```bash
cd backend && uv run python -c "
from backend.prompts.grouping import build_grouping_prompt
print(build_grouping_prompt(
    ['AI', 'Cybersecurity', 'Programming', 'Science', 'Space', 'Technology'],
    {'Technology': ['AI', 'Programming']}
))
"
```

```output
Group these categories into logical parent-child relationships.

**All categories:**
- AI
- Cybersecurity
- Programming
- Science
- Space
- Technology


**Current groups (for context):**
  Technology > AI, Programming

**Rules (follow strictly):**
1. ONLY use the provided category names exactly as written. Do NOT create new categories.
2. Use broader categories as parents and narrower ones as children.
3. Each group must have at least one child.
4. Categories that do not fit any group should remain unparented — do NOT force groupings.
5. No nested groups — only one level of parent-child.

Group these categories now.
```

---

## 3. Provider Protocol Extension

The app uses a `LLMProvider` protocol (Python structural typing) so that any LLM backend can be swapped in. We added `suggest_groups()` to this contract. Note that unlike `categorize()` and `score()`, grouping doesn't need `thinking` mode — it's a simpler structural task:

```bash
sed -n '1,6p;40,48p' backend/src/backend/llm_providers/base.py
```

```output
"""Provider contracts for pluggable LLM integrations."""

from typing import Protocol

from backend.prompts import CategoryResponse, ScoringResponse
from backend.prompts.grouping import GroupingResponse

    async def suggest_groups(
        self,
        all_categories: list[str],
        existing_groups: dict[str, list[str]],
        endpoint: str,
        model: str,
    ) -> GroupingResponse: ...
```

The Ollama implementation delegates to a new `grouping.py` service module. This follows the same pattern as `scoring.py` — the provider adapter is thin, the actual Ollama streaming logic lives in a dedicated module:

```bash
cat backend/src/backend/grouping.py
```

```output
"""LLM-powered category grouping via Ollama structured output."""

import logging

from backend.ollama_client import get_ollama_client
from backend.prompts.grouping import GroupingResponse, build_grouping_prompt

logger = logging.getLogger(__name__)


async def suggest_category_groups(
    all_categories: list[str],
    existing_groups: dict[str, list[str]],
    host: str,
    model: str,
) -> GroupingResponse:
    """Ask Ollama to suggest category groupings.

    Args:
        all_categories: All non-hidden category display names
        existing_groups: Current parent->children mapping
        host: Ollama server URL
        model: Model name

    Returns:
        GroupingResponse with suggested groups
    """
    prompt = build_grouping_prompt(all_categories, existing_groups)

    client = get_ollama_client(host)
    content = ""
    async for chunk in await client.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        format=GroupingResponse.model_json_schema(),
        options={"temperature": 0},
        stream=True,
    ):
        content += chunk["message"].get("content") or ""

    result = GroupingResponse.model_validate_json(content)

    logger.info(
        "Suggested %d category groups",
        len(result.groups),
    )

    return result
```

Key detail: `format=GroupingResponse.model_json_schema()` tells Ollama to constrain its output to match the Pydantic schema exactly. This is Ollama's structured output feature — the LLM is forced to produce valid JSON matching our schema. Combined with `temperature=0`, we get deterministic, parseable results.

Unlike the categorization and scoring calls, grouping doesn't use the `@retry` decorator or update `_scoring_activity` state — it's a user-initiated one-shot call, not part of the background scoring pipeline.

---

## 4. The Suggest Endpoint

`POST /api/categories/auto-group/suggest` is the read-only endpoint. It orchestrates: load categories → resolve provider → call LLM → validate response → return filtered suggestions.

```bash
sed -n '264,322p' backend/src/backend/routers/categories.py
```

```output
            updated += 1

    session.commit()
    return {"ok": True, "updated": updated}


@router.post("/auto-group/suggest", response_model=AutoGroupSuggestResponse)
async def auto_group_suggest(
    body: AutoGroupRequest,
    session: Session = Depends(get_session),
):
    """Ask LLM to suggest category groupings. No DB writes."""
    from backend.scoring import get_active_categories

    display_names, hierarchy, _hidden = get_active_categories(session)

    if len(display_names) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 non-hidden categories to suggest groupings",
        )

    # Resolve provider/model for categorization task
    runtime = resolve_task_runtime(session, "categorization")
    provider_name = body.provider or runtime.provider
    model_name = body.model or runtime.model

    if not model_name:
        raise HTTPException(status_code=400, detail="No model configured")

    provider = get_provider(provider_name)

    # Determine endpoint — for Ollama we need the endpoint from runtime
    endpoint = runtime.endpoint or ""

    response = await provider.suggest_groups(
        all_categories=display_names,
        existing_groups=hierarchy or {},
        endpoint=endpoint,
        model=model_name,
    )

    # Build slug lookup for validation
    all_categories = session.exec(
        select(Category).where(Category.is_hidden == False)  # noqa: E712
    ).all()
    slug_to_name = {slugify(c.display_name): c.display_name for c in all_categories}
    valid_slugs = set(slug_to_name.keys())

    # Filter groups: only include groups where parent AND all children exist
    valid_groups = []
    for group in response.groups:
        parent_slug = slugify(group.parent)
        if parent_slug not in valid_slugs:
            continue
        valid_children = [
            c for c in group.children
            if slugify(c) in valid_slugs and slugify(c) != parent_slug
        ]
```

Important design points in the suggest endpoint:

1. **Provider/model override** — The request body accepts optional `provider` and `model` fields. If omitted, it falls back to the categorization task route (`resolve_task_runtime`). This lets the frontend's multi-provider dialog work.

2. **Post-LLM validation** — After the LLM returns, we slug-match every parent and child name against actual database categories. This catches hallucinated category names. Groups with invalid parents are dropped entirely; groups with some invalid children keep only the valid ones.

3. **No database writes** — The endpoint is purely read-only. The LLM suggestions exist only in the HTTP response, giving the user full control.

---

## 5. The Apply Endpoint

`POST /api/categories/auto-group/apply` performs the actual regrouping. The critical insight is the **flatten-then-regroup** strategy:

```bash
sed -n '325,380p' backend/src/backend/routers/categories.py
```

```output
                GroupSuggestionItem(parent=group.parent, children=valid_children)
            )

    return AutoGroupSuggestResponse(groups=valid_groups)


@router.post("/auto-group/apply", response_model=AutoGroupApplyResponse)
def auto_group_apply(
    body: AutoGroupApplyRequest,
    session: Session = Depends(get_session),
):
    """Apply confirmed groupings: flatten existing groups, then apply new ones."""
    # Step 1: Flatten all existing parent-child relationships
    children_with_parents = session.exec(
        select(Category).where(Category.parent_id.isnot(None))  # type: ignore[union-attr]
    ).all()
    for child in children_with_parents:
        # Inherit parent weight if child has no explicit weight
        if child.weight is None and child.parent_id is not None:
            parent = session.get(Category, child.parent_id)
            if parent and parent.weight is not None:
                child.weight = parent.weight
        child.parent_id = None
        session.add(child)
    session.flush()

    # Step 2: Build slug->category lookup
    all_categories = session.exec(select(Category)).all()
    slug_map: dict[str, Category] = {c.slug: c for c in all_categories}

    # Step 3: Apply new groups
    groups_applied = 0
    categories_moved = 0
    for group in body.groups:
        parent_slug = slugify(group.parent)
        parent_cat = slug_map.get(parent_slug)
        if not parent_cat:
            continue

        moved_in_group = 0
        for child_name in group.children:
            child_slug = slugify(child_name)
            child_cat = slug_map.get(child_slug)
            if not child_cat:
                continue
            # Skip self-references
            if child_cat.id == parent_cat.id:
                continue
            child_cat.parent_id = parent_cat.id
            session.add(child_cat)
            moved_in_group += 1

        if moved_in_group > 0:
            groups_applied += 1
            categories_moved += moved_in_group

```

The three-step algorithm:

1. **Flatten** — Every category with a `parent_id` gets detached. If a child had no explicit weight, it inherits its parent's weight before being orphaned (so `boost` from a parent becomes the child's own `boost` — the user's weight preference isn't lost).

2. **Lookup** — Build a slug-to-Category map from all categories. Using slugs for matching means "AI" and "ai" resolve to the same category.

3. **Regroup** — Walk through the confirmed groups, set `parent_id` on each child. Self-references and non-existent names are silently skipped. A single `session.commit()` at the end makes the whole operation atomic.

The `session.flush()` after Step 1 (instead of `commit()`) is deliberate — it pushes the flatten changes to the DB so the Step 2 query sees orphaned categories, but keeps everything in a single transaction. If Step 3 fails, the entire operation rolls back.

---

## 6. Request/Response Schemas

The API contract between frontend and backend:

```bash
grep -A 30 '# --- Auto-Group ---' backend/src/backend/schemas.py
```

```output
# --- Auto-Group ---


class AutoGroupRequest(BaseModel):
    provider: str | None = None
    model: str | None = None


class GroupSuggestionItem(BaseModel):
    parent: str
    children: list[str]


class AutoGroupSuggestResponse(BaseModel):
    groups: list[GroupSuggestionItem]


class AutoGroupApplyRequest(BaseModel):
    groups: list[GroupSuggestionItem]


class AutoGroupApplyResponse(BaseModel):
    ok: bool
    groups_applied: int
    categories_moved: int
```

---

## 7. Frontend: Types & API Layer

The frontend mirrors these schemas in TypeScript. The types are defined in `lib/types.ts` and the fetch functions in `lib/api.ts`:

```bash
grep -A 15 'export interface GroupSuggestion' frontend/src/lib/types.ts
```

```output
export interface GroupSuggestion {
  parent: string;
  children: string[];
}

export interface AutoGroupSuggestResponse {
  groups: GroupSuggestion[];
}

export interface AutoGroupApplyResponse {
  ok: boolean;
  groups_applied: number;
  categories_moved: number;
}

export interface FetchArticlesParams {
```

```bash
grep -A 25 'export async function autoGroupSuggest' frontend/src/lib/api.ts
```

```output
export async function autoGroupSuggest(
  options?: { provider?: string; model?: string }
): Promise<AutoGroupSuggestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/categories/auto-group/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  if (!response.ok) await throwApiError(response, "Failed to suggest category groupings");
  return response.json();
}

export async function autoGroupApply(
  groups: GroupSuggestion[]
): Promise<AutoGroupApplyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/categories/auto-group/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groups }),
  });
  if (!response.ok) await throwApiError(response, "Failed to apply category groupings");
  return response.json();
}

export async function fetchRefreshStatus(): Promise<RefreshStatus> {
  const response = await fetch(`${API_BASE_URL}/api/feeds/refresh-status`);
```

---

## 8. Frontend: The Mutations Hook

TanStack Query mutations in `useCategories.ts` handle the async lifecycle. The suggest mutation doesn't invalidate any cache (it's read-only), while the apply mutation invalidates the categories query to refresh the tree:

```bash
grep -A 13 'autoGroupSuggestMutation' frontend/src/hooks/useCategories.ts | head -14
```

```output
  const autoGroupSuggestMutation = useMutation({
    mutationFn: (options?: { provider?: string; model?: string }) =>
      apiAutoGroupSuggest(options),
    meta: { errorTitle: "Failed to generate category groupings" },
  });

  const autoGroupApplyMutation = useMutation({
    mutationFn: (groups: GroupSuggestion[]) => apiAutoGroupApply(groups),
    meta: { errorTitle: "Failed to apply category groupings" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });

```

Notice the `meta: { errorTitle }` pattern — this project uses a global `MutationCache` error handler that reads the `errorTitle` from mutation metadata and shows a toast. Individual mutations don't need their own `onError` callbacks for generic error display.

---

## 9. Frontend: AutoGroupButton

The entry point is a simple button with a sparkles icon, rendered in the settings page header. It disables itself when there are fewer than 2 non-hidden categories:

```bash
cat frontend/src/components/settings/AutoGroupButton.tsx
```

```output
"use client";

import { Button } from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";

interface AutoGroupButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AutoGroupButton({ onClick, disabled }: AutoGroupButtonProps) {
  return (
    <Button
      variant="outline"
      colorPalette="accent"
      size="sm"
      onClick={onClick}
      disabled={disabled}
    >
      <LuSparkles size={16} />
      Auto-Group
    </Button>
  );
}
```

---

## 10. Frontend: AutoGroupDialog

The dialog is the most complex frontend component. It has **three visual states** managed by boolean flags:

| State | Trigger | Renders |
|-------|---------|---------|
| **Provider picker** | Multiple providers configured + not yet triggered | Radio-like provider list, optional model picker, Generate button |
| **Loading** | After Generate clicked or auto-triggered | Spinner + "Analyzing categories..." |
| **Preview** | LLM returned results | Folder-tree preview of suggested groups, Apply/Cancel buttons |

When only one provider is configured, the dialog auto-triggers the suggest call on open (skipping the picker). The preview reuses the visual pattern from the existing MoveToGroupDialog — folder icons, indented children, count badges:

```bash
sed -n '19,28p' frontend/src/components/settings/AutoGroupDialog.tsx
```

```output
interface AutoGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggest: (options?: { provider?: string; model?: string }) => void;
  suggestions: GroupSuggestion[] | null;
  isSuggesting: boolean;
  onApply: (groups: GroupSuggestion[]) => void;
  isApplying: boolean;
  allCategories: Category[];
}
```

The dialog is a **controlled component** — the parent (`CategoriesSection`) owns the open state, suggestions, and mutation callbacks. This keeps the dialog stateless with respect to data fetching, making it easy to test and reason about.

The auto-trigger effect is worth examining:

```bash
sed -n '53,68p' frontend/src/components/settings/AutoGroupDialog.tsx
```

```output
  // Auto-trigger suggest when dialog opens with single provider
  useEffect(() => {
    if (open && !multipleProviders && !hasTriggered && suggestions === null && !isSuggesting) {
      setHasTriggered(true);
      onSuggest();
    }
  }, [open, multipleProviders, hasTriggered, suggestions, isSuggesting, onSuggest]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProvider(null);
      setSelectedModel(null);
      setHasTriggered(false);
    }
  }, [open]);
```

The five guard conditions in the auto-trigger effect prevent double-firing: `open` (dialog is visible), `!multipleProviders` (skip picker), `!hasTriggered` (one-shot), `suggestions === null` (no results yet), `!isSuggesting` (not already in flight).

Here's the preview rendering — note how it computes "ungrouped" categories (those the LLM didn't mention) and shows them separately:

```bash
sed -n '71,83p' frontend/src/components/settings/AutoGroupDialog.tsx
```

```output
  const ungroupedCategories = useMemo(() => {
    if (!suggestions) return [];
    const mentioned = new Set<string>();
    for (const group of suggestions) {
      mentioned.add(group.parent.toLowerCase());
      for (const child of group.children) {
        mentioned.add(child.toLowerCase());
      }
    }
    return allCategories
      .filter((c) => !c.is_hidden && !mentioned.has(c.display_name.toLowerCase()))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [suggestions, allCategories]);
```

---

## 11. Frontend: Wiring in CategoriesSection

The top-level `CategoriesSection` component owns all the state and wires the button + dialog together. Here's the key wiring:

```bash
sed -n '68,70p' frontend/src/components/settings/CategoriesSection.tsx
```

```output
  // Auto-group dialog state
  const [autoGroupOpen, setAutoGroupOpen] = useState(false);
  const [autoGroupSuggestions, setAutoGroupSuggestions] = useState<GroupSuggestion[] | null>(null);
```

The button sits in the `SettingsPageHeader`, left of the existing "Add Category" popover:

```bash
sed -n '224,238p' frontend/src/components/settings/CategoriesSection.tsx
```

```output
        >
          <AutoGroupButton
            onClick={() => setAutoGroupOpen(true)}
            disabled={categories.filter((c) => !c.is_hidden).length < 2}
          />
          <CreateCategoryPopover
            onCreateCategory={(displayName) => createCategoryMutation.mutate({ displayName })}
            existingCategories={categories}
          />
        </SettingsPageHeader>

        <CategoryActionBar
          selectedCount={selectedIds.size}
          onMoveToGroup={dialogs.handleActionMoveToGroup}
          onUngroup={dialogs.handleActionUngroup}
```

The dialog wiring is where the separation of concerns pays off. The mutation's inline `onSuccess` handles UI state (close dialog, show toast), while the hook's `onSettled` handles cache invalidation:

```bash
sed -n '267,290p' frontend/src/components/settings/CategoriesSection.tsx
```

```output
          isParent={dialogs.deleteDialogState.isParent}
          childCount={dialogs.deleteDialogState.childCount}
          onConfirm={dialogs.handleDeleteConfirm}
        />

        <AutoGroupDialog
          open={autoGroupOpen}
          onOpenChange={setAutoGroupOpen}
          onSuggest={(options) =>
            autoGroupSuggestMutation.mutate(options, {
              onSuccess: (data) => setAutoGroupSuggestions(data.groups),
            })
          }
          suggestions={autoGroupSuggestions}
          isSuggesting={autoGroupSuggestMutation.isPending}
          onApply={(groups) =>
            autoGroupApplyMutation.mutate(groups, {
              onSuccess: (data) => {
                setAutoGroupOpen(false);
                setAutoGroupSuggestions(null);
                toaster.create({
                  title: `Grouped ${data.categories_moved} categories into ${data.groups_applied} groups`,
                  type: "success",
                });
```

---

## 12. Tests: Proving It Works

The backend was built with strict red/green TDD. The test file covers:

- **Prompt building** (6 tests) — schema validation, prompt structure, sorting
- **Apply endpoint** (5 tests) — basic grouping, flatten with weight preservation, edge cases (nonexistent names, self-references, explicit vs inherited weights)
- **Suggest endpoint** (3 tests) — mocked provider, response filtering, guard clause for <2 categories

Let's run them all:

```bash
cd backend && uv run pytest tests/test_auto_group.py -v 2>&1 | grep -E '(PASSED|FAILED|passed|failed)'
```

```output
tests/test_auto_group.py::TestBuildGroupingPrompt::test_includes_all_category_names PASSED [  7%]
tests/test_auto_group.py::TestBuildGroupingPrompt::test_includes_existing_groups PASSED [ 14%]
tests/test_auto_group.py::TestBuildGroupingPrompt::test_omits_existing_groups_section_when_empty PASSED [ 21%]
tests/test_auto_group.py::TestBuildGroupingPrompt::test_categories_sorted_alphabetically PASSED [ 28%]
tests/test_auto_group.py::TestBuildGroupingPrompt::test_grouping_response_schema PASSED [ 35%]
tests/test_auto_group.py::TestBuildGroupingPrompt::test_grouping_response_empty_groups PASSED [ 42%]
tests/test_auto_group.py::TestAutoGroupApply::test_basic_apply PASSED    [ 50%]
tests/test_auto_group.py::TestAutoGroupApply::test_flattens_existing_groups_before_regrouping PASSED [ 57%]
tests/test_auto_group.py::TestAutoGroupApply::test_preserves_explicit_weight_on_flatten PASSED [ 64%]
tests/test_auto_group.py::TestAutoGroupApply::test_skips_nonexistent_category_names PASSED [ 71%]
tests/test_auto_group.py::TestAutoGroupApply::test_skips_self_reference PASSED [ 78%]
tests/test_auto_group.py::TestAutoGroupSuggest::test_suggest_returns_groups PASSED [ 85%]
tests/test_auto_group.py::TestAutoGroupSuggest::test_suggest_rejects_fewer_than_2_categories PASSED [ 92%]
tests/test_auto_group.py::TestAutoGroupSuggest::test_suggest_excludes_hidden_from_count PASSED [100%]
============================== 14 passed in 0.19s ==============================
```

And no regressions — the full suite:

```bash
cd backend && uv run pytest -q 2>&1 | tail -3
```

```output
........................................................................ [ 75%]
.......................                                                  [100%]
95 passed in 1.10s
```

Frontend builds clean too:

```bash
cd frontend && bun run build 2>&1 | grep -E '(Compiled|Generating|Route|error)'
```

```output
✓ Compiled successfully in 7.7s
  Generating static pages using 7 workers (0/12) ...
  Generating static pages using 7 workers (3/12) 
  Generating static pages using 7 workers (6/12) 
  Generating static pages using 7 workers (9/12) 
✓ Generating static pages using 7 workers (12/12) in 1383.1ms
Route (app)
```

---

## Summary of Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/backend/prompts.py` | **Deleted** | Replaced by `prompts/` package |
| `backend/src/backend/prompts/__init__.py` | **Created** | Backward-compatible re-exports |
| `backend/src/backend/prompts/categorization.py` | **Created** | Categorization schema + prompt |
| `backend/src/backend/prompts/scoring.py` | **Created** | Scoring schema + prompt |
| `backend/src/backend/prompts/grouping.py` | **Created** | Grouping schema + prompt (new) |
| `backend/src/backend/grouping.py` | **Created** | Ollama streaming call for grouping |
| `backend/src/backend/llm_providers/base.py` | **Modified** | Added `suggest_groups()` to protocol |
| `backend/src/backend/llm_providers/ollama.py` | **Modified** | Implemented `suggest_groups()` |
| `backend/src/backend/schemas.py` | **Modified** | Added auto-group request/response schemas |
| `backend/src/backend/routers/categories.py` | **Modified** | Added suggest + apply endpoints |
| `backend/tests/test_auto_group.py` | **Created** | 14 TDD tests |
| `frontend/src/lib/types.ts` | **Modified** | Added GroupSuggestion types |
| `frontend/src/lib/api.ts` | **Modified** | Added API functions |
| `frontend/src/hooks/useCategories.ts` | **Modified** | Added mutations |
| `frontend/src/components/settings/AutoGroupButton.tsx` | **Created** | Trigger button |
| `frontend/src/components/settings/AutoGroupDialog.tsx` | **Created** | Three-state dialog |
| `frontend/src/components/settings/CategoriesSection.tsx` | **Modified** | Wired button + dialog |
