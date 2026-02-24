---
title: fix: Reuse existing root categories when grouping
type: fix
status: active
date: 2026-02-24
---

# fix: Reuse existing root categories when grouping

## Overview
When moving categories into a group, the UI should allow existing root categories (including ungrouped roots) to be selected as group targets. If a user enters a group name that already exists as a root category, that category must be reused instead of creating a duplicate.

## Decisions
- Hidden-category target attempts are blocked with a user message.
- Only root categories can be group targets.

## Scope
- Frontend: move-to-group search and create-or-reuse flow.
- Backend: defensive guard in batch-move API for invalid self-parent attempts.
- Tests: focused regression coverage for create-or-reuse and root-only behavior.

## Proposed Changes

### 1. Expand move target candidates to all visible root categories
Update move dialog target list to include:
- Root categories that already have children (current parents).
- Root categories that currently have no children (ungrouped roots).

Constraints:
- Exclude hidden categories from selectable targets.
- Keep child/non-root categories ineligible.

Primary files:
- frontend/src/components/settings/CategoriesSection.tsx
- frontend/src/components/settings/MoveToGroupDialog.tsx
- frontend/src/hooks/useCategoryTree.ts

### 2. Create-or-reuse logic when typing a group name
In `handleCreateAndMove`:
- Normalize entered name (same normalization behavior as category dedupe logic).
- Find matching existing root category (case-insensitive normalized match).
- If found and visible root: reuse it as `targetParentId`.
- If found but hidden: block action and show toast message.
- If not found: create new category, then use new category id.

Safety:
- Filter selected IDs to remove target parent id before calling `batchMoveMutate`.
- If resulting selection is empty, show info toast and no-op.

Primary files:
- frontend/src/hooks/useCategoryDialogs.ts
- frontend/src/hooks/useCategories.ts (if helper extraction is needed)

### 3. Backend defense for self-parenting and root-only target
In `POST /api/categories/batch-move`:
- Keep existing root-only target enforcement.
- Add explicit guard for self-parent attempt (category id equals target parent id): skip or reject consistently.

Primary file:
- backend/src/backend/routers/categories.py

## UX/Text Updates
- Move dialog placeholder: "Search categories..." (instead of "Search groups...").
- Hidden target block toast: "Cannot use hidden category as a group target. Unhide it first."

## Acceptance Criteria
- User can search and select existing visible root categories as move targets even if they were previously ungrouped.
- Typing an existing visible root category name in create flow reuses that category; no duplicate category is created.
- Typing a hidden category name in create flow is blocked with a clear message; no category is created and no move occurs.
- Non-root categories are never valid targets.
- Self-parent move is prevented both in frontend and backend.

## Test Plan

### Frontend
- Unit/integration test for create-or-reuse path:
  - Existing visible root -> reuse.
  - Existing hidden root -> block.
  - New name -> create then move.
  - Selected includes target -> target removed from move payload.

### Backend
- API test for `batch-move`:
  - Reject/skip self-parent attempts safely.
  - Continue enforcing target must be root.

## Risks
- Name matching drift between frontend and backend normalization.
Mitigation: use slug-style normalization in frontend matching logic and rely on backend validation as source of truth.

## Out of Scope
- Changing broader category dedupe rules.
- Allowing nested parent targets beyond root level.
