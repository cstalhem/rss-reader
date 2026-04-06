---
title: "fix: Two-phase LLM grouping to reduce ungrouped categories (#79)"
type: fix
status: draft
date: 2026-04-05
issue: 79
---

# fix: Two-phase LLM grouping to reduce ungrouped categories (#79)

## Problem

The auto-group feature sends all ~200 categories plus existing groups to the LLM in a single call. The model **anchors** on the existing groups — reproducing them verbatim and ignoring 50-110 ungrouped categories. Research confirms this anchoring bias is not fixable with prompt engineering alone.

Categories like Docker, Node.js, CLI, Education, and Sports clearly belong in groups but are consistently left out.

## Solution: Two-Phase Role Separation

Split the single complex task into two simpler tasks:

**Phase 1 — Propose Themes (creative/divergent):**
- Input: all category names only (no existing groups — avoids anchoring entirely)
- Task: "What parent themes would organize these categories?"
- Output: list of theme strings (`ThemeResponse`)

**Phase 2 — Assign Categories (mechanical/convergent):**
- Input: all category names + the themes from Phase 1
- Task: "Assign each category to the best-fitting theme"
- Output: parent→children mapping (`GroupingResponse`)

This works because smaller models handle each sub-task well individually — Flash Lite scores 94% on intent routing (classification) tasks but struggles with combined creative + classification tasks over long lists.

## Decisions

1. **Option C for theme count** — no hard constraint on number of themes. Group size limits are enforced in Phase 2 rules instead.
2. **No anchoring in Phase 1** — existing groups/parents are NOT passed to the model. It proposes themes purely from the category list. No inter-phase validation of themes either — pass them straight through to Phase 2.
3. **Existing category names can be parents** — the model may reuse existing categories as parent themes or propose new ones.
4. **New parents created on apply** — three-tier parent resolution: (a) parent exists as a root category → reuse it, (b) parent exists as a child/ungrouped category → it's already flattened to root by the flatten step, reuse it, (c) completely new name → create a new Category row.
5. **Self-reference dedup** — already handled at line 383 of the apply endpoint (`child_cat.id == parent_cat.id` skip). No additional work needed.
6. **Old single-pass prompt preserved** — `build_grouping_prompt` kept for now as fallback; can be removed once two-phase is validated.

## Proposed Changes

### 1. New response schema and prompt builders (`prompts/grouping.py`)

Add:
- `ThemeResponse` — Pydantic model with `themes: list[str]` (already added)
- `build_theme_proposal_prompt(all_categories)` — Phase 1 prompt
- `build_assignment_prompt(all_categories, themes)` — Phase 2 prompt

The Phase 1 prompt should:
- List all category names
- No existing groups or parent hints (clean slate to avoid anchoring)
- Ask for broad, meaningful themes — not one per category

The Phase 2 prompt should:
- List all category names + the themes from Phase 1
- Enforce rules: exact child names, min 2 children, 15-20 max per group, no nesting
- Not show existing group children (avoids anchoring)

### 2. Provider changes (`llm_providers/google.py`, `llm_providers/ollama.py`)

Update `suggest_groups` in both providers to:
1. Build Phase 1 prompt → call LLM with `ThemeResponse` schema
2. If Phase 1 returns 0 themes → return empty `GroupingResponse(groups=[])` (everything stays ungrouped)
3. Build Phase 2 prompt using Phase 1 themes → call LLM with `GroupingResponse` schema
4. Return the Phase 2 result

The protocol signature stays the same — the two-phase logic is an implementation detail.

### 3. Suggest endpoint validation (`routers/categories.py`)

Current validation rejects parents not found in DB. Update to:
- Still validate children against DB slugs (must exist)
- Allow new parent names through (they'll be created on apply)
- For new parents: use the LLM-returned name as-is in the suggestion response
- **Deduplicate children across groups** using a `seen_slugs` set (first-assignment-wins), so the preview matches what apply will actually do. If a child appears under two parents, only the first occurrence is kept.

### 4. Apply endpoint — three-tier parent resolution (`routers/categories.py`)

The flatten step already handles case (b) — all categories become roots before regrouping. So the apply loop just needs to handle the "not found" case:

When `slug_map.get(parent_slug)` returns `None`:
- Check if slugified parent name already exists in `slug_map` (handles slug collisions like "Developer Tools" vs "Dev Tools" → same slug)
- If collision: reuse existing category as parent
- If truly new: create a new `Category` row: `display_name` from the group's parent name, `slug` from slugify, `weight=None`, `is_seen=True`
- Flush to get an ID, add to `slug_map`
- Continue with normal child assignment

### 5. Tests (`tests/test_auto_group.py`)

New tests:
- `test_build_theme_proposal_prompt` — includes all category names, no existing groups
- `test_build_assignment_prompt` — includes categories and themes, enforces rules
- `test_theme_response_schema` — validates ThemeResponse model
- `test_suggest_allows_new_parent_names` — new parents pass through validation
- `test_apply_creates_new_parent_category` — new parent auto-created in DB

Updated tests:
- `test_suggest_returns_groups` — mock now returns two-phase provider calls

### 6. Frontend dialog fixes (`AutoGroupDialog.tsx`, `CategoriesSection.tsx`)

Three bugs in the current auto-group dialog flow:

**a) Cancel must clear suggestions.** Currently `handleClose` resets dialog-internal state but does NOT clear `autoGroupSuggestions` in the parent (`CategoriesSection`). This means stale suggestions survive across dialog open/close cycles. Fix: call `setAutoGroupSuggestions(null)` when closing without applying (add an `onCancel` callback or clear in `onOpenChange`).

**b) Re-group must preserve provider/model selection.** Currently `handleRegroup` calls `onSuggest()` with no arguments, losing the user's provider/model choice and falling back to the server default. Fix: pass the current `selectedProvider`/`selectedModel` to `onSuggest(options)`.

**c) Reopening always starts from selection.** This is already correct once (a) is fixed — clearing suggestions + resetting `hasTriggered` in `handleClose` means the dialog starts fresh at the provider picker (or auto-triggers for single provider).

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/backend/prompts/grouping.py` | Add `ThemeResponse` (done), two prompt builders |
| `backend/src/backend/llm_providers/base.py` | No change — protocol stays the same |
| `backend/src/backend/llm_providers/google.py` | Two-phase logic in `suggest_groups` |
| `backend/src/backend/llm_providers/ollama.py` | Two-phase logic in `suggest_groups` |
| `backend/src/backend/routers/categories.py` | Allow new parents in suggest + dedup children, create new parents on apply |
| `backend/tests/test_auto_group.py` | New + updated tests |
| `frontend/src/components/settings/AutoGroupDialog.tsx` | Fix Re-group to preserve provider/model |
| `frontend/src/components/settings/CategoriesSection.tsx` | Clear suggestions on cancel |

## Verification

1. `cd backend && uv run pytest tests/test_auto_group.py -v` — all tests pass
2. `cd backend && uv run ruff check . && uv run ruff format --check .` — clean
3. `cd frontend && bun run build` — no type errors
4. Manual: trigger auto-group from UI, compare ungrouped count (target: <30, down from ~85)
5. Manual: verify cancel clears suggestions, re-group preserves model selection, reopen starts fresh
