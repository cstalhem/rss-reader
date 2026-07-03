---
phase: 09-frontend-codebase-evaluation-simplification
plan: 03
subsystem: ui
tags: [chakra-ui, react, refactoring, semantic-tokens, hooks]

# Dependency graph
requires:
  - phase: 09-02
    provides: Refactored hooks (direct mutation objects, queryKeys, useRenameState)
provides:
  - All components updated for new hook APIs (useCategories, usePreferences, useOllamaConfig)
  - useRenameState adopted by CategoryParentRow, CategoryChildRow, CategoryUngroupedRow, FeedRow
  - ConfirmDialog reusable component for confirmation dialogs
  - Semantic tokens for bg.code, fg.success, fg.warning, fg.error
  - All hardcoded colors replaced with semantic tokens
  - All var(--chakra-colors-*) on react-icons fixed via CSS inheritance
  - All shared constants imported from lib/constants.ts
  - InstalledModelRow extracted from ModelManagement
affects: [09-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ConfirmDialog for all confirmation flows instead of inline Dialog.Root blocks"
    - "CSS color inheritance for react-icons via parent Chakra element color prop"
    - "Named constants at file top for single-file magic numbers"
    - "Semantic tokens for all status colors (success, warning, error)"

key-files:
  created:
    - frontend/src/components/ui/confirm-dialog.tsx
  modified:
    - frontend/src/components/settings/CategoriesSection.tsx
    - frontend/src/components/settings/CategoryParentRow.tsx
    - frontend/src/components/settings/CategoryChildRow.tsx
    - frontend/src/components/settings/CategoryUngroupedRow.tsx
    - frontend/src/components/settings/InterestsSection.tsx
    - frontend/src/components/settings/OllamaSection.tsx
    - frontend/src/components/settings/ModelSelector.tsx
    - frontend/src/components/settings/ModelManagement.tsx
    - frontend/src/components/settings/OllamaHealthBadge.tsx
    - frontend/src/components/settings/OllamaPlaceholder.tsx
    - frontend/src/components/settings/FeedbackPlaceholder.tsx
    - frontend/src/components/settings/SettingsSidebar.tsx
    - frontend/src/components/settings/FeedsSection.tsx
    - frontend/src/components/settings/DeleteCategoryDialog.tsx
    - frontend/src/components/settings/MoveToGroupDialog.tsx
    - frontend/src/components/feed/FeedRow.tsx
    - frontend/src/components/feed/AddFeedDialog.tsx
    - frontend/src/components/article/ArticleReader.tsx
    - frontend/src/components/article/ArticleRow.tsx
    - frontend/src/components/article/ScoreBadge.tsx
    - frontend/src/components/layout/Header.tsx
    - frontend/src/components/layout/Sidebar.tsx
    - frontend/src/components/layout/AppShell.tsx
    - frontend/src/theme/colors.ts

key-decisions:
  - "ConfirmDialog uses accent colorPalette (not red) for ungroup confirmations since ungroup is non-destructive"
  - "fg.success/fg.warning/fg.error semantic tokens used as bg for small indicator dots (OllamaHealthBadge) for simplicity"
  - "InstalledModelRow extracted as co-located component within ModelManagement.tsx (not separate file)"
  - "FeedRow raw HTML input replaced with Chakra Input during useRenameState adoption"

patterns-established:
  - "All confirmation dialogs use ConfirmDialog from @/components/ui/confirm-dialog"
  - "react-icons color set via nearest Chakra parent element color prop (CSS inheritance)"
  - "Layout constants imported from lib/constants.ts, not hardcoded"
  - "Status colors use fg.success/fg.warning/fg.error semantic tokens"

requirements-completed: [SUCCESS_CRITERIA_2, SUCCESS_CRITERIA_5, SUCCESS_CRITERIA_6, SUCCESS_CRITERIA_7, SUCCESS_CRITERIA_8, SUCCESS_CRITERIA_9]

# Metrics
duration: 11.7min
completed: 2026-02-19
---

# Phase 09 Plan 03: Component Consumer Updates Summary

**Updated all 24 consumer components for refactored hook APIs, created ConfirmDialog, fixed all color/token/Portal/Tooltip inconsistencies, and imported shared constants across the codebase**

## Performance

- **Duration:** 11.7 min
- **Started:** 2026-02-19T13:02:30Z
- **Completed:** 2026-02-19T13:14:10Z
- **Tasks:** 2
- **Files modified:** 29 (1 created, 28 modified)

## Accomplishments
- Updated all useCategories consumers in CategoriesSection (9 wrapper function calls migrated to mutation objects)
- Updated usePreferences consumer (InterestsSection) and useOllamaConfig consumer (OllamaSection)
- Adopted useRenameState in 4 components (CategoryParentRow, CategoryChildRow, CategoryUngroupedRow, FeedRow), removing ~100 lines of duplicated rename state management
- Created ConfirmDialog component and replaced 2 inline Dialog.Root blocks in CategoriesSection
- Removed redundant Portal wrappers from DeleteCategoryDialog and MoveToGroupDialog
- Fixed ScoreBadge to use @/components/ui/tooltip wrapper instead of raw Tooltip.Root
- Added 4 semantic tokens (bg.code, fg.success, fg.warning, fg.error) and replaced all hardcoded colors
- Fixed all 8 instances of var(--chakra-colors-*) on react-icons via CSS color inheritance
- Extracted InstalledModelRow from ModelManagement, deduplicating model row rendering
- Fixed Sidebar "All Articles" row with colorPalette="accent"
- Imported shared constants (HEADER_HEIGHT, SIDEBAR_WIDTH_*, NEW_COUNT_POLL_INTERVAL, HIGH_SCORE_THRESHOLD) in layout and article components
- Replaced inline query key strings in Header, SettingsSidebar, ModelManagement, and ArticleReader with queryKeys.*
- Named single-file magic numbers: MAX_VISIBLE_TAGS, SIDEBAR_DOWNLOAD_POLL_INTERVAL

## Task Commits

Each task was committed atomically:

1. **Task 1: Update all components for new hook return shapes and adopt useRenameState** - `8ba6011` (refactor)
2. **Task 2: Create ConfirmDialog, fix Tooltip/Portal/token/color/input inconsistencies, import shared constants** - `dc3e06e` (refactor)

## Files Created/Modified
- `frontend/src/components/ui/confirm-dialog.tsx` - New reusable confirmation dialog component
- `frontend/src/components/settings/CategoriesSection.tsx` - Migrated to mutation objects, replaced inline dialogs with ConfirmDialog, fixed icon color
- `frontend/src/components/settings/CategoryParentRow.tsx` - Adopted useRenameState, fixed LuFolder color
- `frontend/src/components/settings/CategoryChildRow.tsx` - Adopted useRenameState
- `frontend/src/components/settings/CategoryUngroupedRow.tsx` - Adopted useRenameState
- `frontend/src/components/settings/InterestsSection.tsx` - Updated to updatePreferencesMutation API
- `frontend/src/components/settings/OllamaSection.tsx` - Removed savedConfig, fixed icon color
- `frontend/src/components/settings/ModelSelector.tsx` - Replaced hardcoded orange with fg.warning via CSS inheritance
- `frontend/src/components/settings/ModelManagement.tsx` - Extracted InstalledModelRow, replaced query key, fg.error token
- `frontend/src/components/settings/OllamaHealthBadge.tsx` - Replaced red.500/green.500 with fg.error/fg.success
- `frontend/src/components/settings/OllamaPlaceholder.tsx` - Fixed icon color via CSS inheritance
- `frontend/src/components/settings/FeedbackPlaceholder.tsx` - Fixed icon color via CSS inheritance
- `frontend/src/components/settings/SettingsSidebar.tsx` - Imported queryKeys, constants, named poll interval
- `frontend/src/components/settings/FeedsSection.tsx` - Fixed icon color via CSS inheritance
- `frontend/src/components/settings/DeleteCategoryDialog.tsx` - Removed redundant Portal wrapper
- `frontend/src/components/settings/MoveToGroupDialog.tsx` - Removed redundant Portal wrapper
- `frontend/src/components/feed/FeedRow.tsx` - Adopted useRenameState, replaced raw HTML input with Chakra Input
- `frontend/src/components/feed/AddFeedDialog.tsx` - Replaced green.600 with fg.success
- `frontend/src/components/article/ArticleReader.tsx` - Replaced oklch with bg.code, added queryKeys + meta
- `frontend/src/components/article/ArticleRow.tsx` - Imported HIGH_SCORE_THRESHOLD, named MAX_VISIBLE_TAGS
- `frontend/src/components/article/ScoreBadge.tsx` - Fixed raw Tooltip.Root, imported HIGH_SCORE_THRESHOLD
- `frontend/src/components/layout/Header.tsx` - Imported HEADER_HEIGHT, queryKeys, NEW_COUNT_POLL_INTERVAL
- `frontend/src/components/layout/Sidebar.tsx` - Imported layout constants, added colorPalette="accent"
- `frontend/src/components/layout/AppShell.tsx` - Imported layout constants
- `frontend/src/theme/colors.ts` - Added bg.code, fg.success, fg.warning, fg.error tokens

## Decisions Made
- Used accent colorPalette (not red) for ungroup ConfirmDialog since ungroup is non-destructive
- Used fg.success/fg.error tokens as background color for OllamaHealthBadge status dots (small indicators, simpler than creating separate status tokens)
- Kept InstalledModelRow co-located in ModelManagement.tsx instead of extracting to a separate file (single consumer)
- Replaced FeedRow raw HTML input with Chakra Input during useRenameState adoption (combined fix, consistent with other row components)
- Removed per-mutation onError from InterestsSection handleSave since MutationCache handles errors globally via meta.errorTitle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All components now use consistent patterns (mutation objects, semantic tokens, shared constants, queryKeys)
- Plan 04 can proceed with any remaining cleanup or verification
- Build passes, zero TypeScript errors

## Self-Check: PASSED

All created files verified on disk. All commit hashes found in git log.

---
*Phase: 09-frontend-codebase-evaluation-simplification*
*Completed: 2026-02-19*
