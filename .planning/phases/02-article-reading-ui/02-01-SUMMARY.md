---
phase: 02-article-reading-ui
plan: "01"
subsystem: ui
tags: [chakra-ui, next.js, react, theme, dark-mode, typescript]

# Dependency graph
requires:
  - phase: 01-production-infrastructure
    provides: Next.js app foundation with Docker setup
provides:
  - Chakra UI v3 theme system with custom orange accent
  - Dark/light theme toggle with localStorage persistence
  - Application shell layout (Header + Sidebar + Content)
  - Collapsible sidebar navigation structure
  - Responsive layout foundation
affects: [02-article-reading-ui, 03-feed-management, 05-polish-deployment]

# Tech tracking
tech-stack:
  added:
    - "@chakra-ui/react": "Component library with theme system"
    - "@emotion/react": "CSS-in-JS runtime for Chakra"
    - "next-themes": "Theme management with SSR support"
    - "react-icons": "Icon library (lucide icons)"
  patterns:
    - "Custom Chakra theme with createSystem and defaultConfig"
    - "Semantic tokens for light/dark mode (bg, fg, border)"
    - "next/font/google for optimized font loading"
    - "Client component pattern for interactive UI ('use client')"
    - "Fixed header + collapsible sidebar layout structure"

key-files:
  created:
    - frontend/src/theme/index.ts
    - frontend/src/theme/colors.ts
    - frontend/src/theme/typography.ts
    - frontend/src/components/ui/provider.tsx
    - frontend/src/components/theme/ThemeToggle.tsx
    - frontend/src/components/layout/Header.tsx
    - frontend/src/components/layout/Sidebar.tsx
    - frontend/src/components/layout/AppShell.tsx
  modified:
    - frontend/package.json
    - frontend/next.config.ts
    - frontend/tsconfig.json
    - frontend/src/app/layout.tsx
    - frontend/src/app/globals.css
    - frontend/src/app/page.tsx

key-decisions:
  - "Dark mode as default theme (user preference)"
  - "Orange accent: oklch(64.6% 0.222 41.116)"
  - "Inter font for UI, Lora for article reader content"
  - "Sidebar collapse state managed in AppShell parent component"
  - "Sidebar hidden on mobile (< md breakpoint)"

patterns-established:
  - "Theme tokens via defineTokens/defineSemanticTokens"
  - "CSS variables for fonts (--font-sans, --font-serif)"
  - "Lifted state pattern for shared layout state"
  - "Responsive design via Chakra breakpoints"

# Metrics
duration: 9min
completed: 2026-02-07
---

# Phase 02 Plan 01: Theme and Shell Summary

**Chakra UI v3 with custom orange-accented dark theme, collapsible sidebar, and header with theme toggle**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-07T08:44:35Z
- **Completed:** 2026-02-07T08:53:35Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- Chakra UI v3 integrated with custom theme system (dark default, orange accent)
- Application shell layout with fixed header, collapsible sidebar, and scrollable content area
- Theme toggle in header switches between dark/light modes with localStorage persistence
- Typography system with Inter (UI) and Lora (reader) fonts configured via next/font/google
- Clean, minimal aesthetic using semantic tokens (bg, fg, border)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Chakra UI and create custom theme system** - `164fcfe` (feat)
2. **Task 2: Build application shell layout** - `8d640e0` (feat)

## Files Created/Modified

### Theme System
- `frontend/src/theme/index.ts` - Custom Chakra system with dark default
- `frontend/src/theme/colors.ts` - Orange accent color tokens for light/dark modes
- `frontend/src/theme/typography.ts` - Font tokens (sans/serif) and text styles
- `frontend/src/components/ui/provider.tsx` - Chakra + ColorMode provider wrapper

### Layout Components
- `frontend/src/components/layout/Header.tsx` - Fixed header with app title and theme toggle
- `frontend/src/components/layout/Sidebar.tsx` - Collapsible sidebar (240px expanded, 48px collapsed)
- `frontend/src/components/layout/AppShell.tsx` - Main layout combining header, sidebar, content
- `frontend/src/components/theme/ThemeToggle.tsx` - Sun/moon icon button for theme switching

### Configuration
- `frontend/package.json` - Added Chakra UI dependencies
- `frontend/next.config.ts` - Added optimizePackageImports for Chakra
- `frontend/tsconfig.json` - Changed target to ESNext (Chakra v3 requirement)
- `frontend/src/app/layout.tsx` - Provider setup with suppressHydrationWarning
- `frontend/src/app/globals.css` - Removed default Next.js styles
- `frontend/src/app/page.tsx` - Updated to use AppShell layout

## Decisions Made

1. **Dark mode default:** User preference for dark theme as default, aligns with typical RSS reader use case (reading at night)
2. **Orange accent:** Used exact user-specified color oklch(64.6% 0.222 41.116) for brand consistency
3. **Dual font system:** Inter for UI elements (clean, readable), Lora serif for article reader content (comfortable long-form reading)
4. **Sidebar state management:** Lifted collapse state to AppShell parent so content area margin can sync with sidebar width transitions
5. **Mobile responsiveness:** Sidebar hidden on screens < md breakpoint (will add mobile menu in polish phase if needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - Chakra CLI snippet generation and Next.js integration worked smoothly. Build passed cleanly after all configurations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02-02 (Article List Component):**
- Theme system fully configured and working
- Layout shell ready to receive article list content
- Semantic tokens established for consistent styling
- Orange accent visible and ready for interactive elements
- Sidebar structure in place for feed navigation (Phase 3)

**No blockers.**

## Self-Check: PASSED

All created files verified:
- ✓ frontend/src/theme/index.ts
- ✓ frontend/src/theme/colors.ts
- ✓ frontend/src/theme/typography.ts
- ✓ frontend/src/components/ui/provider.tsx
- ✓ frontend/src/components/theme/ThemeToggle.tsx
- ✓ frontend/src/components/layout/Header.tsx
- ✓ frontend/src/components/layout/Sidebar.tsx
- ✓ frontend/src/components/layout/AppShell.tsx

All commits verified:
- ✓ 164fcfe (Task 1)
- ✓ 8d640e0 (Task 2)

---
*Phase: 02-article-reading-ui*
*Completed: 2026-02-07*
