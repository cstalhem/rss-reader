# Phase 6: UI & Theme Polish - Research

**Researched:** 2026-02-15
**Domain:** Chakra UI v3 theming, dark mode design tokens, component polish, settings page layout
**Confidence:** HIGH

## Summary

This phase is a frontend-only polish pass. The core technical work involves: (1) redefining Chakra UI v3 semantic color tokens to create a warm-tinted dark mode, (2) building proper loading skeletons that match component layouts, (3) adding toast feedback for API operations, (4) restructuring the settings page with sidebar navigation and new sections, (5) improving reader typography with constrained width and Fira Code for code blocks, and (6) creating rich empty states with icons and action prompts.

The existing codebase is well-structured for this work. The theme system (`frontend/src/theme/`) already uses `createSystem` with custom `colorTokens` and `semanticTokens` in OKLCH format. The toaster infrastructure is already set up at `frontend/src/components/ui/toaster.tsx` with `createToaster({ placement: "bottom-end" })`. Skeletons are already used in `ArticleList.tsx` but are basic. The settings page is a single-page layout that needs to be decomposed into a multi-section sidebar layout.

**Primary recommendation:** Start with the color token overhaul (it touches everything visually), then layer on component-level changes (skeletons, empty states, reader typography, settings restructure) which are independent of each other.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Warm-tinted dark backgrounds (slight brownish/amber undertone) -- inspired by Readwise/Reader aesthetic
- Moderately softer contrast: lift backgrounds from near-black (~10% lightness) to dark gray (~15-18%), text stays high contrast but not pure white
- Orange accent stays vibrant at current saturation -- deliberate pop against softer backgrounds
- Three surface levels: base background, panel/card, overlay/drawer -- each a distinct warm-tinted step
- Subtle border lines for separation between elements (thin, low-opacity)
- Dark mode only -- light mode stays as Chakra defaults
- Read/unread visual distinction (opacity 1.0 vs 0.6 + dot indicators) stays unchanged, just update colors to match new palette
- Sidebar navigation on the left, content area on the right for settings
- Four sections: Feeds, Interests, Ollama, Feedback
- Feeds section added to settings (add/remove/reorder feeds), but existing sidebar feed management stays unchanged
- Ollama and Feedback sections show as placeholders ("Coming soon")
- On mobile (narrow screens): sidebar disappears, sections stack vertically as a scrollable page
- Content body constrained to ~680px max-width, centered within the 75vw drawer
- Keep current font size (18px/1.125rem) and line height (1.75) for body text
- Article title in sans-serif (Inter), body content stays serif (Lora) -- modern contrast
- More distinct article header: larger title, more breathing room, clearer visual break before body
- Polish code blocks: Fira Code monospace font, proper padding, distinct background from body
- Drawer stays at 75vw on desktop, 100% on mobile

### Claude's Discretion
- Exact warm-tint hue values for the three background levels
- Skeleton shimmer animation timing and color
- Icon choices for empty states
- Code block background color and padding values
- Settings sidebar width and styling
- Toast auto-dismiss timing
- Specific spacing values for the reader header "masthead"

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @chakra-ui/react | ^3.32.0 | Component library + theme system | Already in use, provides Skeleton, Toast, semantic tokens |
| @emotion/react | ^11.14.0 | CSS-in-JS for keyframes and custom styles | Already in use for animations |
| react-icons (lu) | ^5.5.0 | Lucide icon set | Already in use, has all needed empty state icons |
| next/font/google | (bundled with Next.js 16) | Font loading for Fira Code | Already used for Inter and Lora |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Fira_Code (Google Font) | N/A | Monospace font for code blocks in reader | Loaded via `next/font/google` in `layout.tsx` |

**No new npm packages needed.** Everything required is already available in the existing dependencies. Fira Code is loaded through `next/font/google` which is part of Next.js.

### Installation
```bash
# No installation needed -- Fira Code is loaded via next/font/google, not npm
```

## Architecture Patterns

### Current Theme Structure (no change to file organization)
```
frontend/src/
├── theme/
│   ├── index.ts          # createSystem config (add new semantic tokens here)
│   ├── colors.ts         # Color tokens + semantic tokens (main changes here)
│   └── typography.ts     # Font tokens + text styles (add mono token)
├── app/
│   ├── layout.tsx        # Add Fira_Code font loading
│   └── settings/
│       └── page.tsx      # Restructure: sidebar nav + section components
├── components/
│   ├── settings/         # NEW: Section components for settings page
│   │   ├── SettingsSidebar.tsx
│   │   ├── InterestsSection.tsx
│   │   ├── FeedsSection.tsx
│   │   ├── OllamaPlaceholder.tsx
│   │   └── FeedbackPlaceholder.tsx
│   ├── article/
│   │   ├── ArticleList.tsx      # Upgrade skeletons, improve empty state
│   │   ├── ArticleRow.tsx       # Colors update automatically via tokens
│   │   ├── ArticleReader.tsx    # Add max-width, improve header, code blocks
│   │   └── ArticleRowSkeleton.tsx  # NEW: Skeleton matching ArticleRow layout
│   └── feed/
│       └── EmptyFeedState.tsx   # Upgrade with icon + action button
```

### Pattern 1: Semantic Token Override for Dark Mode
**What:** Override Chakra's default dark mode semantic tokens with warm-tinted OKLCH values
**When to use:** All background, foreground, and border color customization
**Example:**
```typescript
// In colors.ts - override semantic tokens for dark mode only
// Light mode keeps Chakra defaults, dark mode gets warm tint
export const semanticTokens = defineSemanticTokens.colors({
  bg: {
    DEFAULT: {
      value: { _light: "white", _dark: "oklch(15% 0.01 55)" },
    },
    subtle: {
      value: { _light: "{colors.gray.50}", _dark: "oklch(17% 0.012 55)" },
    },
    muted: {
      value: { _light: "{colors.gray.100}", _dark: "oklch(20% 0.014 55)" },
    },
    emphasized: {
      value: { _light: "{colors.gray.200}", _dark: "oklch(24% 0.016 55)" },
    },
    panel: {
      value: { _light: "white", _dark: "oklch(16% 0.011 55)" },
    },
  },
  // ... fg, border tokens similarly
});
```

### Pattern 2: Settings Page with Sidebar Navigation
**What:** Client-side section switching using state, not routes
**When to use:** Settings page restructure
**Why not routes:** Four sections is too few to warrant `/settings/feeds`, `/settings/interests`, etc. URL routing adds complexity (loading states per route, layout nesting) for no user benefit. State-based switching keeps it simple.
```typescript
// settings/page.tsx
const [activeSection, setActiveSection] = useState<SettingsSection>("interests");

// Desktop: sidebar + content area side by side
// Mobile: no sidebar, all sections stacked vertically
```

### Pattern 3: Skeleton Matching Component Layout
**What:** Skeleton components that mirror the exact layout of real content
**When to use:** Article list loading, settings page loading
**Example:**
```typescript
// ArticleRowSkeleton.tsx - mirrors ArticleRow layout
function ArticleRowSkeleton() {
  return (
    <Flex py={3} px={4} gap={3} borderBottom="1px solid" borderColor="border.subtle">
      {/* Read dot placeholder */}
      <Skeleton variant="circle" boxSize="10px" alignSelf="center" />
      {/* Content area */}
      <Flex flex={1} direction="column" gap={1}>
        <Skeleton height="20px" width="80%" />
        <Skeleton height="16px" width="50%" />
      </Flex>
      {/* Score badge placeholder */}
      <Skeleton height="24px" width="40px" borderRadius="md" />
    </Flex>
  );
}
```

### Pattern 4: Toast for API Feedback
**What:** Use existing `toaster` for all API success/error feedback
**When to use:** All mutation callbacks
**Note:** The toaster is already configured and mounted. Most mutations in settings already have toast callbacks. The work is ensuring ALL API calls have proper toast feedback, not just settings saves.
```typescript
// The toaster is already set up in toaster.tsx with:
// createToaster({ placement: "bottom-end", pauseOnPageIdle: true })
// Add duration to the createToaster config for auto-dismiss control
```

### Anti-Patterns to Avoid
- **Don't create separate CSS files for dark mode overrides** -- use Chakra semantic tokens exclusively
- **Don't use hardcoded hex/rgb values in components** -- always reference semantic tokens (`bg.subtle`, `fg.muted`, etc.)
- **Don't create a new route per settings section** -- use client-side state switching
- **Don't hand-roll skeleton animations** -- use Chakra's built-in `Skeleton` component with `variant="shine"`
- **Don't abstract empty states into a generic component prematurely** -- each empty state has unique content, icon, and actions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading skeletons | Custom CSS shimmer animation | Chakra `<Skeleton variant="shine">` | Built-in pulse/shine variants, respects theme colors, accessible |
| Toast notifications | Custom notification system | Existing `toaster` from `components/ui/toaster.tsx` | Already configured, bottom-end placement, auto-dismiss |
| Color mode switching | Manual class toggling | Chakra semantic tokens with `_dark` values | Automatic dark/light resolution, single source of truth |
| Font loading | `<link>` tags or @import | `next/font/google` Fira_Code | Automatic subsetting, zero CLS, self-hosted |
| Settings section routing | Next.js nested routes | `useState<SettingsSection>` | Four sections don't need URL routing; state is simpler |

**Key insight:** This phase is about using existing infrastructure better (theme tokens, toaster, Skeleton), not adding new infrastructure.

## Common Pitfalls

### Pitfall 1: OKLCH Browser Support
**What goes wrong:** Some older browsers don't support OKLCH color format
**Why it happens:** OKLCH is relatively new (2022+)
**How to avoid:** This project already uses OKLCH for the accent palette (`colors.ts`) and targets modern browsers. Not a real concern for a personal app, but worth noting.
**Warning signs:** Colors rendering as transparent or black in testing

### Pitfall 2: Semantic Token Merge Behavior
**What goes wrong:** Custom semantic tokens don't override defaults, they merge incorrectly
**Why it happens:** `createSystem(defaultConfig, customConfig)` deep-merges configs. If you only override `bg.DEFAULT._dark` but not `bg.DEFAULT._light`, the light mode value from defaultConfig persists correctly. However, if you restructure the token shape, you might lose default values.
**How to avoid:** Always provide both `_light` and `_dark` values when overriding semantic tokens. For light mode, reference the Chakra defaults explicitly (e.g., `_light: "white"` for bg, `_light: "{colors.gray.50}"` for bg.subtle).
**Warning signs:** Light mode suddenly looking wrong after dark mode changes

### Pitfall 3: Skeleton Height Mismatch
**What goes wrong:** Skeletons are different heights than actual content, causing layout shift when data loads
**Why it happens:** Skeletons use fixed heights that don't match the real component's rendered height
**How to avoid:** Build skeleton components that mirror the exact structure (same padding, gap, flex layout) of the real component. Use the same container props.
**Warning signs:** Content jumping when loading completes

### Pitfall 4: Settings Section State Loss on Navigation
**What goes wrong:** User edits interests textarea, switches to Feeds tab, switches back -- edits are lost
**Why it happens:** Section components unmount when hidden, losing local state
**How to avoid:** Keep all sections mounted but visually hidden with `display: none`, OR lift form state to the parent settings page. The simpler approach: since Interests is the only section with form state, just keep all sections rendered and use CSS display to toggle visibility.
**Warning signs:** Form data disappearing after tab switches

### Pitfall 5: Fira Code Font Not Loading
**What goes wrong:** Code blocks render in system monospace instead of Fira Code
**Why it happens:** Missing `subsets: ['latin']` in the `Fira_Code()` call, or CSS variable not applied to body
**How to avoid:** Include `subsets: ['latin']` in the font config. Add the variable class to `<body>` in layout.tsx. Reference the CSS variable in the typography tokens.
**Warning signs:** Monospace text looking different from expected Fira Code appearance

### Pitfall 6: Mobile Settings Layout Breakpoint
**What goes wrong:** Settings sidebar overlaps content on medium-width screens
**Why it happens:** Incorrect breakpoint or missing responsive hiding
**How to avoid:** Use Chakra's responsive props: sidebar gets `display={{ base: "none", md: "block" }}`. On mobile, sections stack vertically with a top section selector or just show all sections.
**Warning signs:** Sidebar and content overlapping between 768px-960px

## Code Examples

### Warm-Tinted OKLCH Dark Mode Tokens
```typescript
// Source: Verified pattern from existing colors.ts + Chakra v3 semantic tokens docs
// Hue 55 = warm amber/brown. Low chroma (0.01-0.02) for subtle warmth.
// Three surface levels:
//   Base: ~15% lightness (main background)
//   Panel: ~16-17% lightness (sidebar, header, cards)
//   Overlay: ~18-20% lightness (drawer, modal)

// Recommended values (Claude's discretion):
const darkBg = {
  base:     "oklch(15% 0.010 55)",    // Main app background
  subtle:   "oklch(17% 0.012 55)",    // Sidebar, card backgrounds
  muted:    "oklch(20% 0.014 55)",    // Hover states
  emphasized: "oklch(24% 0.016 55)",  // Active/selected states
  panel:    "oklch(16% 0.011 55)",    // Header, fixed panels
};

// Foreground: not pure white, slightly warm
const darkFg = {
  DEFAULT:  "oklch(93% 0.005 55)",    // Primary text
  muted:    "oklch(65% 0.008 55)",    // Secondary text
  subtle:   "oklch(50% 0.006 55)",    // Tertiary/disabled
};

// Borders: warm-tinted, low opacity feel
const darkBorder = {
  DEFAULT:    "oklch(30% 0.012 55)",  // Standard borders
  subtle:     "oklch(22% 0.010 55)",  // Faint separators
  emphasized: "oklch(35% 0.014 55)",  // Strong borders
};
```

### Fira Code Font Loading in layout.tsx
```typescript
// Source: next/font/google docs + existing pattern in layout.tsx
import { Inter, Lora, Fira_Code } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const lora = Lora({ subsets: ["latin"], variable: "--font-serif" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-mono" });

// In the body tag:
<body className={`${inter.variable} ${lora.variable} ${firaCode.variable}`}>
```

### Typography Token for Monospace
```typescript
// In typography.ts, add mono font token:
export const fontTokens = defineTokens.fonts({
  sans: { value: "var(--font-sans), system-ui, sans-serif" },
  serif: { value: "var(--font-serif), Georgia, serif" },
  mono: { value: "var(--font-mono), 'Fira Code', monospace" },
});
```

### Reader Code Block Styling
```typescript
// In ArticleReader.tsx, update the code block CSS:
"& pre": {
  bg: "oklch(13% 0.008 55)",   // Darker than body background
  p: 5,
  borderRadius: "lg",
  overflowX: "auto",
  my: 5,
  borderWidth: "1px",
  borderColor: "border.subtle",
},
"& code": {
  fontFamily: "mono",           // References the new mono token
  fontSize: "0.875em",
  lineHeight: "1.6",
},
"& pre code": {
  // Reset inline code styles for code blocks
  bg: "transparent",
  p: 0,
},
"& :not(pre) > code": {
  // Inline code
  bg: "bg.emphasized",
  px: 1.5,
  py: 0.5,
  borderRadius: "sm",
  fontSize: "0.875em",
},
```

### Reader Header "Masthead" Improvement
```typescript
// In ArticleReader.tsx, the article header section:
<Flex direction="column" gap={5} mb={10}>
  {/* Title -- larger, more prominent */}
  <Text
    fontFamily="sans"
    fontSize="3xl"
    fontWeight="700"
    lineHeight="1.25"
    letterSpacing="-0.01em"
  >
    {article.title}
  </Text>

  {/* Metadata row */}
  <Flex gap={3} alignItems="center" fontSize="sm" color="fg.muted">
    {/* ... existing metadata ... */}
  </Flex>

  {/* ... categories, score ... */}

  {/* Visual break before body */}
  <Separator />
</Flex>

{/* Body content -- constrained width */}
<Box
  textStyle="reader"
  maxW="680px"
  mx="auto"
  css={{ /* ... */ }}
  dangerouslySetInnerHTML={{ __html: contentHtml }}
/>
```

### Skeleton Component for Article Rows
```typescript
// New component: ArticleRowSkeleton.tsx
import { Flex, Skeleton, Box } from "@chakra-ui/react";

export function ArticleRowSkeleton() {
  return (
    <Flex py={3} px={4} gap={3} borderBottom="1px solid" borderColor="border.subtle">
      <Box flexShrink={0} alignSelf="center" px={2}>
        <Skeleton variant="circle" boxSize="10px" />
      </Box>
      <Flex flex={1} direction="column" gap={2}>
        <Skeleton height="18px" width="75%" variant="shine" />
        <Skeleton height="14px" width="45%" variant="shine" />
      </Flex>
      <Skeleton height="22px" width="36px" borderRadius="md" alignSelf="center" variant="shine" />
    </Flex>
  );
}
```

### Settings Page Structure
```typescript
// settings/page.tsx - restructured
type SettingsSection = "feeds" | "interests" | "ollama" | "feedback";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("interests");

  return (
    <Box minHeight="100vh" bg="bg">
      <Header />
      <Container maxW="5xl" py={8} px={6} pt="88px">
        <Flex gap={8}>
          {/* Sidebar navigation -- hidden on mobile */}
          <Box
            display={{ base: "none", md: "block" }}
            width="200px"
            flexShrink={0}
          >
            <SettingsSidebar
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </Box>

          {/* Content area */}
          <Box flex={1} minW={0}>
            {/* Mobile: show all sections stacked */}
            <Box display={{ base: "block", md: "none" }}>
              <Stack gap={10}>
                <FeedsSection />
                <InterestsSection />
                <OllamaPlaceholder />
                <FeedbackPlaceholder />
              </Stack>
            </Box>

            {/* Desktop: show active section only */}
            <Box display={{ base: "none", md: "block" }}>
              {activeSection === "feeds" && <FeedsSection />}
              {activeSection === "interests" && <InterestsSection />}
              {activeSection === "ollama" && <OllamaPlaceholder />}
              {activeSection === "feedback" && <FeedbackPlaceholder />}
            </Box>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
```

### Empty State Component Pattern
```typescript
// Pattern for empty states -- icon + message + optional action
import { Flex, Text, Icon, Button } from "@chakra-ui/react";
import { LuInbox } from "react-icons/lu";

function EmptyState({
  icon: IconComponent,
  message,
  actionLabel,
  onAction,
}: {
  icon: React.ElementType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      gap={4}
      py={16}
      px={8}
    >
      <Icon as={IconComponent} boxSize={12} color="fg.subtle" />
      <Text fontSize="lg" color="fg.muted" textAlign="center">
        {message}
      </Text>
      {actionLabel && onAction && (
        <Button variant="outline" colorPalette="accent" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Flex>
  );
}
```

### Lucide Icons for Empty States
```typescript
// Available icons from react-icons/lu (already installed):
import {
  LuInbox,        // No articles / empty inbox
  LuRss,          // No feeds yet
  LuMessageSquare, // No feedback yet
  LuTag,          // No categories configured
  LuSearch,       // No search results
  LuBan,          // No blocked articles
  LuCheckCircle,  // All caught up (unread empty)
} from "react-icons/lu";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chakra v2 `useColorModeValue()` | Chakra v3 semantic tokens with `_dark` | Chakra v3 (2024) | Tokens handle dark mode automatically, no hooks needed |
| Chakra v2 `<Skeleton isLoaded>` | Chakra v3 `<Skeleton loading>` | Chakra v3 (2024) | Prop renamed from `isLoaded` to `loading` |
| Chakra v2 `useToast()` hook | Chakra v3 `createToaster()` + `toaster.create()` | Chakra v3 (2024) | Singleton pattern, no hook needed |
| Hex/RGB color definitions | OKLCH color space | 2022+ | Perceptually uniform, better for generating consistent palettes |

**Deprecated/outdated:**
- `isLoaded` prop on Skeleton -- renamed to `loading` in v3
- `useToast()` hook -- replaced by `createToaster()` singleton in v3
- `startColor`/`endColor` on Skeleton -- v2 API; v3 uses `variant="pulse"` or `variant="shine"`

## Open Questions

1. **Skeleton `variant` props in Chakra v3**
   - What we know: Chakra v3 Skeleton supports `variant` prop. Multiple sources reference "pulse" and "shine" as available variants.
   - What's unclear: The exact behavior/appearance difference between pulse and shine. The v3 docs page didn't render full API details.
   - Recommendation: Use `variant="shine"` for the shimmer effect (matches the user's "shimmer animation" requirement). If it doesn't work as expected, the default animation is a pulse which is also acceptable. Test empirically.
   - Confidence: MEDIUM -- multiple sources confirm variants exist but exact API not verified from official docs.

2. **Chakra v3 Skeleton color customization**
   - What we know: v2 had `startColor`/`endColor` props. v3 may use different mechanism (theme recipe).
   - What's unclear: Whether v3 Skeleton inherits warm tint from semantic bg tokens or needs explicit color override.
   - Recommendation: First try without customization -- if the Skeleton respects `bg.subtle`/`bg.muted` tokens, the warm tint will apply automatically. If not, customize via the skeleton recipe in the theme.
   - Confidence: MEDIUM -- depends on implementation detail of Skeleton recipe.

3. **Settings Feeds section -- reuse vs. new component**
   - What we know: Feed management already exists in the sidebar (add, delete, reorder, rename, mark all read). The settings page needs similar functionality.
   - What's unclear: How much to duplicate vs. share between sidebar and settings.
   - Recommendation: Extract shared feed list logic into the settings section, but don't try to share UI components between sidebar and settings -- they have different layouts and interaction patterns. The sidebar is compact; settings can be more spacious.
   - Confidence: HIGH -- this is an architecture decision, not a technical unknown.

## Sources

### Primary (HIGH confidence)
- Chakra UI v3 Semantic Tokens docs: https://chakra-ui.com/docs/theming/semantic-tokens
- Chakra UI v3 Customizing Dark Mode guide: https://chakra-ui.com/guides/theming-customize-dark-mode-colors
- Chakra UI v3 Colors customization: https://chakra-ui.com/docs/theming/customization/colors
- Next.js Font Optimization docs: https://nextjs.org/docs/app/getting-started/fonts
- Existing codebase analysis (theme/colors.ts, theme/typography.ts, theme/index.ts, all components)

### Secondary (MEDIUM confidence)
- Chakra UI v3 Skeleton component: https://chakra-ui.com/docs/components/skeleton -- confirmed pulse/shine variants exist, exact API needs empirical verification
- Chakra UI v3 Toast component: https://www.chakra-ui.com/docs/components/toast -- createToaster configuration verified
- Fira Code + next/font issue resolution: https://github.com/vercel/next.js/issues/41916 -- confirmed `subsets: ['latin']` required

### Tertiary (LOW confidence)
- None -- all findings verified with at least one authoritative source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything already installed
- Architecture: HIGH -- codebase thoroughly analyzed, patterns clear
- Color tokens: HIGH -- Chakra v3 semantic token override pattern well-documented
- Skeleton variants: MEDIUM -- variants confirmed to exist, exact API not fully verified from docs
- Settings restructure: HIGH -- straightforward state-based section switching
- Reader typography: HIGH -- existing pattern just needs refinement

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable domain, no fast-moving dependencies)
