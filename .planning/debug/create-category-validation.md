---
status: diagnosed
trigger: "create-category-validation"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:03:00Z
---

## Current Focus

hypothesis: Frontend CreateCategoryPopover validates duplicates at UI level, but mutation has no onSuccess/onError toast handlers
test: Evidence gathered from backend endpoint, frontend popover, and mutation hook
expecting: Backend doesn't need duplicate check (frontend prevents it), but mutation needs toast handlers
next_action: Confirm root cause and provide diagnosis

## Symptoms

expected: Creating a duplicate category shows an error toast; creating a new category shows a success toast
actual: User reported: "Still possible to create categories that have the same name as existing ones without getting an error toast. A duplicate is not created though. New categories appear instantly but no success-toast is shown."
errors: None reported
reproduction: Test 8 in UAT round 2 — click Add Category, enter a name that already exists, click Create. No error shown. Then create a genuinely new category — no success toast.
timeline: Plan 08.1-05 fixed the backend to include manually_created categories, but did not add duplicate validation or toast feedback.

## Eliminated

- hypothesis: Backend doesn't validate duplicates
  evidence: Backend POST /api/categories/create (lines 948-979 in main.py) does NOT check for duplicates. However, frontend CreateCategoryPopover.tsx (line 22) validates isDuplicate before allowing creation. The button is disabled when isInvalid (line 72), so backend validation isn't strictly needed for duplicate prevention.
  timestamp: 2026-02-17T00:01:00Z

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: backend/src/backend/main.py POST /api/categories/create endpoint (lines 948-979)
  found: Backend creates category with kebab-case normalization, adds to seen_categories and manually_created. NO duplicate check. Returns {"name": cat_name}.
  implication: Backend doesn't validate duplicates, but frontend prevents submission via disabled button.

- timestamp: 2026-02-17T00:01:30Z
  checked: frontend/src/components/settings/CreateCategoryPopover.tsx
  found: Lines 20-24 compute isDuplicate by checking existingCategories (normalized lowercase). Line 72 disables Create button when isInvalid (isEmpty || isDuplicate). Line 53-54 shows inline errorText "Category already exists" when duplicate detected.
  implication: Frontend prevents duplicate submission at UI level. Inline validation works. But if user COULD submit a duplicate somehow (or if the check has edge cases), there's no backend validation or error toast.

- timestamp: 2026-02-17T00:02:00Z
  checked: frontend/src/lib/api.ts createCategory function (lines 347-357)
  found: Basic fetch wrapper. Throws error on !response.ok. Returns { name: string }.
  implication: API client propagates HTTP errors correctly.

- timestamp: 2026-02-17T00:02:30Z
  checked: frontend/src/hooks/useCategories.ts createCategoryMutation (lines 69-76)
  found: useMutation with mutationFn: apiCreateCategory, onSuccess invalidates queries. NO onError handler. NO toast on success or error.
  implication: ROOT CAUSE — mutation has NO toast handlers. Success toasts and error toasts are missing.

## Resolution

root_cause: createCategoryMutation in frontend/src/hooks/useCategories.ts (lines 69-76) has NO onSuccess or onError handlers with toast notifications. When a category is successfully created, no success toast appears. If creation fails for any reason (network error, backend error), no error toast appears.
fix: Add onSuccess handler with toaster.create (type: "success") and onError handler with toaster.create (type: "error") to createCategoryMutation.
verification: After fix, create a new category → success toast appears. Simulate network error or backend failure → error toast appears.
files_changed:
  - frontend/src/hooks/useCategories.ts
