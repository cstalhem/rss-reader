---
phase: 06-ui-theme-polish
plan: 02
subsystem: frontend
tags: [ui, polish, ux, reader, skeletons, empty-states, toasts]
dependency_graph:
  requires: [06-01]
  provides: [polished-reader, layout-matched-skeletons, enhanced-empty-states]
  affects: [article-reading-experience, loading-states, user-guidance]
tech_stack:
  added: []
  patterns:
    - Layout-matched skeleton components prevent CLS during loading
    - Icon-based empty states with contextual messaging guide users
    - Constrained reader width (680px) optimizes reading comfort
    - Fira Code monospace font via semantic token for code blocks
key_files:
  created:
    - frontend/src/components/article/ArticleRowSkeleton.tsx
  modified:
    - frontend/src/components/article/ArticleReader.tsx
    - frontend/src/components/article/ArticleList.tsx
    - frontend/src/components/feed/EmptyFeedState.tsx
    - frontend/src/components/ui/toaster.tsx
decisions: []
metrics:
  duration: 2.7 minutes
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  commits: 2
  completed_date: 2026-02-15
---

# Phase 06 Plan 02: Reading Experience Polish Summary

Polished article reading experience with constrained width, improved typography, Fira Code code blocks, layout-matched skeletons, and icon-based empty states.

## Execution Summary

**Plan executed exactly as written.** All tasks completed successfully with no deviations required. Both tasks focused on polish and UX improvements to the article reader and loading/empty states.

### Tasks Completed

| # | Name | Type | Commit | Files |
|---|------|------|--------|-------|
| 1 | Improve reader typography, header, and code blocks | auto | 94029cb | ArticleReader.tsx |
| 2 | Add article row skeletons, enhance empty states, configure toast auto-dismiss | auto | ce49b89 | ArticleRowSkeleton.tsx, ArticleList.tsx, EmptyFeedState.tsx, toaster.tsx |

## Implementation Details

### Task 1: Reader Typography and Code Block Polish

**Changes to ArticleReader.tsx:**

1. **Article header improvements:**
   - Increased title from `fontSize="2xl"` to `"3xl"` for prominence
   - Set `fontFamily="sans"` explicitly (Inter) per architectural decision
   - Added `fontWeight="700"` and `letterSpacing="-0.01em"` for tighter, more readable titles
   - Tightened `lineHeight` to `"1.25"` for multi-line title cohesion
   - Increased header gap from `4` to `5` and bottom margin from `8` to `10` for breathing room

2. **Body content width constraint:**
   - Added `maxW="680px"` and `mx="auto"` to article body container
   - Header section remains full-width (spans entire drawer)
   - Constrained width optimizes line length for comfortable reading

3. **Code block polish:**
   - Used `fontFamily: "mono"` (Fira Code via semantic token from Plan 01)
   - Changed background from `bg.subtle` to `oklch(13% 0.008 55)` for darker contrast
   - Increased padding from `4` to `5`, border radius from `md` to `lg`
   - Added `borderWidth: "1px"` with `borderColor: "border.subtle"`
   - Distinguished inline code (`bg: "bg.emphasized"`) from code blocks
   - Set `pre code` to `bg: "transparent"` to avoid double backgrounds

**Result:** Reader provides a comfortable, focused reading experience with polished typography and distinct code block styling.

### Task 2: Skeletons, Empty States, and Toast Auto-Dismiss

**New component: ArticleRowSkeleton.tsx**

Created layout-matched skeleton component that mirrors ArticleRow structure:
- Read dot placeholder (10px circle)
- Content area with two text lines (18px and 14px heights)
- Score badge placeholder (22px × 36px)
- Uses `variant="shine"` for shimmer animation
- Matches exact padding, gap, and border styling of real ArticleRow

**Updates to ArticleList.tsx:**

1. **Loading state:** Replaced generic `Stack` with 5 instances of `ArticleRowSkeleton` to prevent layout shift
2. **Empty states:** Added icon-based empty states with contextual icons:
   - `LuCheckCheck` for "unread" tab (all caught up)
   - `LuInbox` for "all" tab (no articles yet)
   - `LuClock` for "scoring" tab (no pending articles)
   - `LuBan` for "blocked" tab (no blocked articles)
3. **Empty state enhancement:** Added helper text for "all" empty state: "Add feeds from the sidebar to get started"
4. **Layout:** Centered flex column with `direction="column"`, `gap={4}`, `py={16}`, icons at `boxSize={12}`

**Updates to EmptyFeedState.tsx:**

- Added `LuRss` icon at `boxSize={10}`
- Split message into two lines: "No feeds yet" (main) and "Tap + above to add your first feed" (helper)
- Changed layout to vertical flex with `direction="column"` and `gap={3}`

**Updates to toaster.tsx:**

- Added `duration: 4000` to `createToaster` config for 4-second auto-dismiss
- Toast coverage already complete (settings mutations have callbacks, feed mutations use inline feedback)

**Result:** Loading states match real content layout, empty states guide users with icons and contextual messages, toasts auto-dismiss consistently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used wrong icon name (LuCheckCircle instead of LuCheckCheck)**
- **Found during:** Task 2 TypeScript verification
- **Issue:** Imported `LuCheckCircle` which doesn't exist in `react-icons/lu`
- **Fix:** Changed to `LuCheckCheck` which exists and provides a similar "all caught up" semantic
- **Files modified:** ArticleList.tsx (imports and icon mapping)
- **Commit:** ce49b89 (bundled with Task 2)

No other deviations required. Plan was accurate and complete.

## Verification Results

All verification criteria passed:

- ✅ ArticleReader.tsx has `maxW="680px"` on body (line 224)
- ✅ ArticleReader.tsx has `fontSize="3xl"` on title (line 115)
- ✅ ArticleReader.tsx has `fontFamily: "mono"` in code block CSS (line 277)
- ✅ ArticleRowSkeleton.tsx exists and matches ArticleRow layout structure
- ✅ ArticleList.tsx imports and uses ArticleRowSkeleton for loading state (lines 13, 195)
- ✅ ArticleList.tsx empty states include icons from react-icons/lu (line 5)
- ✅ EmptyFeedState.tsx shows LuRss icon with descriptive text (lines 4, 17)
- ✅ toaster.tsx has `duration: 4000` in createToaster config (line 15)

## Self-Check: PASSED

**Created files verified:**
```
FOUND: frontend/src/components/article/ArticleRowSkeleton.tsx
```

**Modified files verified:**
```
FOUND: frontend/src/components/article/ArticleReader.tsx
FOUND: frontend/src/components/article/ArticleList.tsx
FOUND: frontend/src/components/feed/EmptyFeedState.tsx
FOUND: frontend/src/components/ui/toaster.tsx
```

**Commits verified:**
```
FOUND: 94029cb (Task 1: reader typography and code blocks)
FOUND: ce49b89 (Task 2: skeletons, empty states, toasts)
```

All artifacts present and accounted for.

## Impact Assessment

**User-facing improvements:**
- Longer articles are more comfortable to read with constrained body width
- Code snippets are easier to scan with Fira Code font and distinct backgrounds
- Loading states no longer cause layout shift (skeleton matches real content)
- Empty states provide immediate visual context and guide next actions
- Toast notifications auto-dismiss without requiring manual dismissal

**Technical improvements:**
- ArticleRowSkeleton is reusable for any list loading state
- Icon-based empty states follow a consistent pattern across components
- Toast duration configured centrally for consistent behavior

**Future considerations:**
- Skeleton shimmer animation depends on Chakra v3's `variant="shine"` support (may need fallback verification)
- Code block background uses explicit OKLCH value instead of semantic token (intentional for darker contrast)
- Toast duration (4s) may need adjustment based on user feedback

## Success Criteria Met

✅ Reader provides a comfortable reading experience with constrained width and polished code blocks
✅ Loading states use shimmer skeletons that match real content layout
✅ Empty states guide users with icons and helpful messages
✅ Toasts auto-dismiss consistently
✅ All verification checks passed
✅ No blocking issues or architectural changes required

## Next Steps

Plan 06-03 will add the Settings page Feeds section with inline feed management.
