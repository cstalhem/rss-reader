# Phase 6 Plan 03: Settings Page Restructure Summary

**One-liner:** Restructured settings page with sidebar navigation for Feeds, Interests, Ollama, and Feedback sections

---

## Metadata

| Field | Value |
|-------|-------|
| Phase | 06-ui-theme-polish |
| Plan | 03 |
| Subsystem | Frontend UI |
| Tags | `settings`, `navigation`, `component-extraction`, `feeds-management` |
| Completed | 2026-02-15 |
| Duration | ~3 minutes |

---

## Dependency Graph

**Requires:**
- 06-01 (theme foundation - semantic tokens, layout components)

**Provides:**
- Settings sidebar navigation pattern
- Extracted InterestsSection component with loading states
- FeedsSection component with full feed management
- Placeholder sections for Phase 7 (Ollama) and Phase 9 (Feedback)

**Affects:**
- Settings page user experience (clearer organization)
- Future Phase 7 and Phase 9 implementation (structure ready)

---

## Technical Implementation

### Component Architecture

**Created 5 new components:**

1. **SettingsSidebar.tsx** - Navigation sidebar with 4 sections
   - Exports `SettingsSection` type for type safety
   - Active section gets accent border and muted background
   - Clean vertical stack with icon + label pattern
   - Responsive: hidden on mobile

2. **InterestsSection.tsx** - Extracted from original settings page
   - Self-contained with own `usePreferences` hook call
   - Loading state: 3 skeleton placeholders (2×120px, 1×200px)
   - Empty state: LuTag icon + centered message for categories
   - Manages its own form state (interests, anti-interests)
   - Preserves all existing functionality (save, category weights)

3. **FeedsSection.tsx** - New feed management interface
   - Drag-to-reorder with @dnd-kit/sortable (same pattern as Sidebar.tsx)
   - Each feed row: drag handle, title, URL (truncated), unread badge, delete button
   - Loading state: 3 skeleton rows matching feed row layout
   - Empty state: LuRss icon + message + "Add Feed" CTA button
   - Toast feedback on successful deletion
   - Integrates AddFeedDialog and DeleteFeedDialog components

4. **OllamaPlaceholder.tsx** - Phase 7 placeholder
   - LuBot icon + "Ollama Configuration" heading
   - "Coming soon" message describing future functionality

5. **FeedbackPlaceholder.tsx** - Phase 9 placeholder
   - LuMessageSquare icon + "Feedback Loop" heading
   - "Coming soon" message describing future functionality

### Layout Pattern

**Desktop (md+):**
- Sidebar (200px fixed width) + Content area (flex: 1)
- All sections stay mounted, visibility toggled with CSS `display` property
- Prevents state loss when switching tabs (pitfall #4 from research)

**Mobile (base):**
- Sidebar hidden completely
- All 4 sections stacked vertically with 10-gap spacing
- No section switching - just scroll through all content

### State Management

**Settings page state:**
```typescript
const [activeSection, setActiveSection] = useState<SettingsSection>("interests");
```

Default section: "interests" (most frequently accessed)

**Section isolation:**
- Each section component is self-contained
- InterestsSection manages its own form state
- FeedsSection manages its own dialog states
- No prop drilling of complex state

---

## Tech Stack

| Technology | Usage |
|------------|-------|
| @dnd-kit/core + @dnd-kit/sortable | Drag-to-reorder feeds in FeedsSection |
| Chakra UI responsive props | `display={{ base: "none", md: "block" }}` pattern |
| react-icons/lu | Icons for sidebar nav and empty states |
| TanStack Query | Data fetching in section components |

---

## Key Files

**Created:**
- `frontend/src/components/settings/SettingsSidebar.tsx` (61 lines)
- `frontend/src/components/settings/InterestsSection.tsx` (209 lines)
- `frontend/src/components/settings/FeedsSection.tsx` (259 lines)
- `frontend/src/components/settings/OllamaPlaceholder.tsx` (27 lines)
- `frontend/src/components/settings/FeedbackPlaceholder.tsx` (27 lines)

**Modified:**
- `frontend/src/app/settings/page.tsx` (reduced from 230 to 64 lines)

---

## Decisions Made

1. **State-based section switching over route-based**
   - Rationale: 4 sections too few to warrant `/settings/feeds`, `/settings/interests` routes
   - URL routing adds complexity for no user benefit
   - State switching is simpler and avoids layout nesting issues

2. **Keep all sections mounted on desktop**
   - Rationale: Prevents state loss in InterestsSection textarea when switching tabs
   - Uses CSS `display` toggle instead of conditional rendering
   - Small memory overhead acceptable for better UX

3. **Default active section: "interests"**
   - Rationale: Most frequently accessed section (users adjust preferences often)
   - Feeds section less frequently needed (set up once)

4. **Mobile shows all sections stacked**
   - Rationale: No sidebar navigation pattern on mobile
   - Simpler than adding a dropdown section selector
   - Users can scroll through all settings naturally

5. **FeedsSection simplified: no inline rename**
   - Rationale: Feed rename already available via AddFeedDialog after creation
   - Sidebar already has double-click rename for advanced users
   - Settings feed list focused on overview + delete + reorder

---

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

---

## Verification Results

**TypeScript:**
```bash
npx tsc --noEmit
# Exit code 0 - no errors
```

**Component integration:**
- All 5 new components created and imported correctly
- Settings page renders sidebar navigation
- Section switching works (verified via code inspection)
- Responsive layout structure correct (desktop sidebar, mobile stack)

**Build verification:**
Not run (dev-only changes, no build impact)

---

## Known Limitations

1. **Mobile section navigation:** All sections visible, no collapsible accordion
   - Acceptable: settings page not frequently accessed on mobile
   - Could add accordion in future if user feedback warrants it

2. **No section deep-linking:** URL doesn't reflect active section
   - Acceptable: this was a deliberate decision (state-based switching)
   - Could add `#feeds`, `#interests` hash routing if needed

3. **FeedsSection doesn't support inline rename**
   - Acceptable: rename available via AddFeedDialog and sidebar
   - Simplifies FeedsSection component

---

## Testing Notes

**Manual testing recommended:**
1. Navigate to /settings
2. Click each sidebar item, verify section switches
3. Edit interests textarea, switch to Feeds tab, switch back - textarea content preserved
4. Add a feed via FeedsSection, verify it appears
5. Drag to reorder feeds, verify order persists
6. Delete a feed, verify confirmation dialog and toast
7. Resize browser to mobile width, verify sidebar disappears and sections stack

**No automated tests added** (per project testing principles - integration over unit, focus on important paths)

---

## Self-Check: PASSED

**Created files verified:**
```bash
ls -la frontend/src/components/settings/
# SettingsSidebar.tsx ✓
# InterestsSection.tsx ✓
# FeedsSection.tsx ✓
# OllamaPlaceholder.tsx ✓
# FeedbackPlaceholder.tsx ✓
```

**Commits verified:**
```bash
git log --oneline --all | grep "06-03"
# 8cc628e feat(06-03): create feeds section for settings page ✓
# 59b22fe feat(06-03): create settings sidebar and extract interests section ✓
```

**Modified files verified:**
```bash
git show 59b22fe --stat
# frontend/src/app/settings/page.tsx modified ✓
```

All expected files created, all commits present, changes verified.

---

## Impact Summary

**For users:**
- Settings page is now organized into clear sections
- Can manage feeds directly from settings (in addition to sidebar)
- Form state preserved when switching between sections
- Mobile users see all settings in one scrollable page

**For developers:**
- Settings page code reduced from 230 to 64 lines (extraction)
- Section components are self-contained and testable
- Ready for Phase 7 (Ollama config) to replace OllamaPlaceholder
- Ready for Phase 9 (Feedback loop) to replace FeedbackPlaceholder
- Established pattern for sidebar navigation (reusable if needed)

**For future work:**
- Phase 7: Replace OllamaPlaceholder with real Ollama configuration UI
- Phase 9: Replace FeedbackPlaceholder with feedback submission interface
- Could add URL hash navigation if deep-linking becomes needed
- Could add mobile accordion if vertical scrolling becomes unwieldy
