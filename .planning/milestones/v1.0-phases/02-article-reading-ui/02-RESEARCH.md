# Phase 2: Article Reading UI - Research

**Researched:** 2026-02-05
**Domain:** React + Next.js App Router + Chakra UI v3
**Confidence:** HIGH

## Summary

Phase 2 delivers an article browsing and reading interface built with Next.js 16 App Router and Chakra UI v3. The research confirms that Chakra UI v3 is well-suited for this phase, providing built-in dark mode support via `next-themes`, a comprehensive Drawer component for the slide-in reading panel, and semantic tokens for automatic theme adaptation.

The standard approach uses TanStack Query for server state management, Intersection Observer API for viewport-based read tracking, and localStorage for theme persistence. Chakra UI v3's component architecture is designed for React Server Components with selective client-side interactivity via the `'use client'` directive.

**Primary recommendation:** Use Chakra UI v3's Drawer component for the reading panel, semantic tokens (`bg.subtle`, etc.) for automatic theming, TanStack Query for article data fetching with background sync, and Intersection Observer API combined with setTimeout debouncing for the auto-mark-as-read behavior (10-15 second delay after viewport visibility).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Article list layout:**
- Relaxed list layout (not cards, not cramped) — multi-line rows with breathing room
- Each row displays: title, muted source, date
- Titles truncate with ellipsis (single line, uniform row height)
- "Load more" button at bottom (not infinite scroll, not pagination)
- Reserve layout space for future LLM reasoning/summary display (Phase 5)

**Reading experience:**
- Slide-in panel from the right, ~75% width on desktop
- Full-screen panel on mobile/smaller screens
- Full article content rendered in-app with clean typography
- Close via X button or clicking outside the panel
- Prev/next arrows to navigate between articles within the panel

**Read/unread behavior:**
- Auto-mark as read after 10-15 seconds of viewing (prevents accidental marks)
- Manual toggle available to mark read/unread
- Visual indicators for unread: opacity difference (read = faded) + indicator dot
- Default view: unread articles only
- Toggle to show all articles (read + unread)

**Theme & visual style:**
- Dark mode as default
- Theme toggle in header AND in settings
- Minimal/clean aesthetic — lots of whitespace, subtle borders, content-focused
- Orange accent color: `oklch(64.6% 0.222 41.116)`
- Sans-serif for UI elements
- Serif font for article reader content
- Generous typography in reader — larger text, more line spacing
- Images displayed in reader but constrained (max width/height)
- Collapsible sidebar navigation with feeds/sections

### Claude's Discretion

- Exact spacing and padding values
- Loading states and skeletons
- Error state handling
- Specific serif/sans-serif font choices
- Sidebar collapse behavior and breakpoints
- Panel slide animation timing

### Deferred Ideas (OUT OF SCOPE)

- Bulk "mark all as read" action — future iteration
- LLM reasoning/summary display in article list — Phase 5 (Interest-Driven UI)
- Feed management in sidebar — Phase 3 (Feed Management)
- Article filtering by score — Phase 5
</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @chakra-ui/react | 3.32.0+ | Component library | Prop-based theming, built-in dark mode via next-themes, comprehensive component set, RSC-compatible |
| @emotion/react | ^11.0.0 | CSS-in-JS runtime | Required peer dependency for Chakra UI styling engine |
| next | 16.1.6 | React framework | Already in use, App Router with RSC support |
| react | 19.2.3 | UI library | Already in use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/query | ^5.0.0 | Server state management | Article fetching, caching, background sync, stale-while-revalidate |
| react-intersection-observer | ^9.0.0 | Viewport detection | Auto-mark as read based on visibility duration |
| next-themes | Latest | Theme management | Already integrated by Chakra UI v3 for dark/light mode |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chakra UI | Material-UI (MUI) | MUI has more components but heavier bundle; Chakra is lighter and easier to customize |
| TanStack Query | SWR | SWR is simpler but lacks advanced features like optimistic updates and devtools |
| Intersection Observer | Scroll event listeners | Scroll events are less performant and require manual throttling/debouncing |

**Installation:**
```bash
# Phase 2 new dependencies
npm install @chakra-ui/react @emotion/react
npm install @tanstack/react-query
npm install react-intersection-observer

# Chakra UI CLI for component snippets
npx @chakra-ui/cli snippet add
```

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── app/
│   ├── layout.tsx              # Root layout with Chakra Provider
│   ├── page.tsx                # Article list page
│   └── providers.tsx           # Client component for providers
├── components/
│   ├── ui/                     # Chakra UI generated snippets
│   │   ├── provider.tsx        # ColorModeProvider + ChakraProvider
│   │   ├── drawer.tsx          # Drawer component from CLI
│   │   └── button.tsx          # Button variants
│   ├── article/
│   │   ├── ArticleList.tsx     # List container with load more
│   │   ├── ArticleRow.tsx      # Single article row with read state
│   │   └── ArticleReader.tsx   # Drawer panel with full content
│   ├── layout/
│   │   ├── Header.tsx          # Theme toggle + branding
│   │   └── Sidebar.tsx         # Collapsible navigation
│   └── theme/
│       └── ThemeToggle.tsx     # Dark/light mode button
├── hooks/
│   ├── useArticles.ts          # TanStack Query hook for articles
│   ├── useMarkAsRead.ts        # Auto-mark logic with Intersection Observer
│   └── useReadState.ts         # Read/unread state management
├── lib/
│   ├── api.ts                  # API client for backend
│   └── queryClient.ts          # TanStack Query configuration
└── theme/
    ├── index.ts                # Chakra theme customization
    ├── colors.ts               # Custom orange accent + semantic tokens
    ├── typography.ts           # Font definitions (sans + serif)
    └── components.ts           # Component style overrides
```

### Pattern 1: Chakra UI v3 Provider Setup

**What:** Wrap Next.js App Router application with Chakra's Provider component that combines ChakraProvider and ColorModeProvider (via next-themes)

**When to use:** Required at root layout for all Chakra components to function

**Example:**
```typescript
// src/app/providers.tsx
'use client'

import { Provider } from '@/components/ui/provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>
}

// src/app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```
**Source:** [Chakra UI v3 Next.js App Router Guide](https://chakra-ui.com/docs/get-started/frameworks/next-app)

### Pattern 2: Semantic Tokens for Automatic Theming

**What:** Use Chakra's built-in semantic tokens like `bg.subtle`, `text.muted`, `border.subtle` that automatically adapt to dark/light mode

**When to use:** For all UI colors to ensure proper theme switching without manual `_dark` overrides

**Example:**
```typescript
// Preferred (automatic theme adaptation)
<Box bg="bg.subtle" borderColor="border.subtle">
  <Text color="text.muted">Source</Text>
</Box>

// Avoid unless specific override needed
<Box bg={{ base: "white", _dark: "gray.800" }}>
  <Text color={{ base: "gray.600", _dark: "gray.400" }}>Source</Text>
</Box>
```
**Source:** [Chakra UI v3 Dark Mode Documentation](https://chakra-ui.com/docs/styling/dark-mode)

### Pattern 3: Drawer Component for Article Reader

**What:** Chakra's Drawer component provides slide-in panel with overlay, positioning, and accessibility built-in

**When to use:** For the article reading panel that slides from right with backdrop

**Example:**
```typescript
import { Drawer } from '@/components/ui/drawer'

function ArticleReader({ article, isOpen, onClose }) {
  return (
    <Drawer.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} placement="right">
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{article.title}</Drawer.Title>
            <Drawer.CloseTrigger />
          </Drawer.Header>
          <Drawer.Body>
            {/* Article content with serif typography */}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}
```
**Source:** [Chakra UI v3 Drawer Component](https://chakra-ui.com/docs/components/drawer)

### Pattern 4: TanStack Query for Article Fetching

**What:** Use TanStack Query for server state management with caching, background sync, and stale-while-revalidate

**When to use:** For fetching articles, marking read/unread, and maintaining sync with backend

**Example:**
```typescript
// src/hooks/useArticles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useArticles({ filter = 'unread', limit = 20, offset = 0 }) {
  return useQuery({
    queryKey: ['articles', filter, limit, offset],
    queryFn: () => fetchArticles({ filter, limit, offset }),
    staleTime: 30_000, // 30 seconds
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (articleId: string) => markArticleAsRead(articleId),
    onSuccess: () => {
      // Invalidate and refetch articles list
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}
```
**Source:** [TanStack Query v5 Documentation](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)

### Pattern 5: Auto-Mark as Read with Intersection Observer

**What:** Combine Intersection Observer API with setTimeout debouncing to auto-mark articles as read after viewing for 10-15 seconds

**When to use:** For automatic read state management based on viewport visibility duration

**Example:**
```typescript
// src/hooks/useMarkAsRead.ts
import { useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'

export function useAutoMarkAsRead(articleId: string, onMarkAsRead: () => void) {
  const { ref, inView } = useInView({ threshold: 0.5 })
  const timerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (inView) {
      // Start 12 second timer when article enters viewport
      timerRef.current = setTimeout(() => {
        onMarkAsRead()
      }, 12000)
    } else {
      // Clear timer if article leaves viewport before completing
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [inView, onMarkAsRead])

  return ref
}
```
**Source:** [MDN Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)

### Pattern 6: Load More Button Pattern

**What:** Button-based pagination that appends new articles to existing list, not infinite scroll

**When to use:** For loading additional articles at user's explicit request

**Example:**
```typescript
function ArticleList() {
  const [offset, setOffset] = useState(0)
  const { data, isLoading } = useArticles({ offset, limit: 20 })

  const handleLoadMore = () => setOffset(prev => prev + 20)
  const hasMore = data?.total > offset + 20

  return (
    <>
      {data?.articles.map(article => (
        <ArticleRow key={article.id} article={article} />
      ))}
      {hasMore && (
        <Button onClick={handleLoadMore} isLoading={isLoading}>
          Load More
        </Button>
      )}
    </>
  )
}
```
**Source:** [React Pagination Guide](https://hygraph.com/blog/react-pagination)

### Anti-Patterns to Avoid

- **Don't use scroll events for read tracking:** Use Intersection Observer instead for better performance and built-in viewport detection
- **Don't manually manage color values for themes:** Use Chakra's semantic tokens to ensure automatic dark/light mode adaptation
- **Don't fetch article content on list render:** Only fetch full content when user opens the reading panel
- **Don't use infinite scroll:** User requested explicit "load more" button for better control
- **Don't override Chakra's built-in drawer animations:** They're optimized for performance and accessibility

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark/light theme toggle | Custom theme context with localStorage | Chakra's ColorModeProvider (wraps next-themes) | Handles SSR hydration, localStorage sync, system preference detection, and flash prevention |
| Viewport visibility tracking | Custom scroll event listeners | Intersection Observer API | Async, non-blocking, handles all edge cases (partial visibility, multiple elements, root margins) |
| Debouncing read timer | Custom setTimeout logic with useRef | Intersection Observer + useEffect cleanup | Built-in cleanup on unmount, automatic timer cancellation on visibility change |
| Article state caching | Custom state management with useContext | TanStack Query | Automatic background refetching, request deduplication, optimistic updates, cache invalidation |
| Responsive drawer panel | Custom CSS transforms and media queries | Chakra Drawer component | Accessibility (focus trap, keyboard nav), smooth animations, backdrop handling, portal rendering |
| Typography scales | Manual font-size and line-height values | Chakra's textStyles | Responsive scaling, semantic naming, consistent spacing ratios |

**Key insight:** Chakra UI v3 and TanStack Query solve most of the hard problems in this domain. Focus implementation effort on business logic (read state management, article rendering) rather than reinventing UI primitives.

## Common Pitfalls

### Pitfall 1: Theme Flash on Initial Load

**What goes wrong:** Users see a flash of light mode before dark mode applies, even when dark is the default preference

**Why it happens:** Theme detection runs client-side after hydration, causing a visual jump between SSR'd HTML and client-rendered themed version

**How to avoid:**
- Use Chakra's Provider with `defaultTheme="dark"` prop
- Add `suppressHydrationWarning` to `<html>` tag in layout
- Ensure theme preference is read from localStorage before first render

**Warning signs:** Visible flash of white background on page load when dark mode should be active

**Source:** [Next.js App Router with Chakra UI](https://chakra-ui.com/docs/get-started/frameworks/next-app)

### Pitfall 2: Drawer Performance on Mobile

**What goes wrong:** Drawer animations feel janky or sluggish on mobile devices, especially older phones

**Why it happens:** Heavy JavaScript execution during animation frames, or large DOM trees being transformed

**How to avoid:**
- Use Chakra's built-in drawer animations (GPU-accelerated CSS transforms)
- Lazy-load article content until drawer is fully open
- Avoid re-rendering parent components when drawer opens (use React.memo or separate state)
- Keep drawer content lightweight initially, load images/rich content after animation completes

**Warning signs:** Frame drops during drawer slide animation, delayed response to close gestures

**Source:** [Material-UI SwipeableDrawer Performance Issue](https://github.com/mui/material-ui/issues/31009)

### Pitfall 3: Auto-Mark as Read Firing Too Early

**What goes wrong:** Articles marked as read when user just scrolls past them quickly, not when actually reading

**Why it happens:** Intersection Observer threshold too low (0.0), or timer duration too short, or not clearing timer on rapid scrolls

**How to avoid:**
- Set Intersection Observer threshold to 0.5 (50% of article must be visible)
- Use 10-15 second timer, not 2-3 seconds
- Clear timer in useEffect cleanup when article leaves viewport
- Consider `rootMargin` to delay trigger until article is centered in viewport

**Warning signs:** Users complain articles marked as read when they didn't read them, high unread-to-read ratio without engagement

**Source:** [MDN Timing Element Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API/Timing_element_visibility)

### Pitfall 4: TanStack Query Cache Invalidation Issues

**What goes wrong:** Article list shows stale read/unread states after marking an article, or updates don't propagate between list and reader

**Why it happens:** Query keys not properly structured, or forgetting to invalidate related queries after mutations

**How to avoid:**
- Structure query keys hierarchically: `['articles', filter, offset]` not `['articles-unread']`
- Invalidate ALL article queries after mark-as-read mutation: `queryClient.invalidateQueries({ queryKey: ['articles'] })`
- Use optimistic updates for instant UI feedback before server confirms
- Consider using `queryClient.setQueryData` for immediate cache updates

**Warning signs:** Article remains unread in list after closing reader, refresh required to see updated state

**Source:** [TanStack Query Best Practices](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)

### Pitfall 5: Serif Font Not Loading in Reader

**What goes wrong:** Article content displays in sans-serif even though serif font is specified, or causes layout shift when font loads

**Why it happens:** Font not preloaded, FOIT (flash of invisible text), or CSS specificity issues with Chakra's text styles

**How to avoid:**
- Use Next.js `next/font/google` for automatic font optimization and preloading
- Define custom textStyle in Chakra theme for reader content
- Set `font-display: swap` to show fallback font while loading
- Preload serif font in layout.tsx head section

**Warning signs:** Text invisible on initial render, layout shifts after font loads, console warnings about font loading

**Source:** [Next.js Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)

### Pitfall 6: Not Reserving Space for Future LLM Summary

**What goes wrong:** When Phase 5 adds LLM reasoning/summary to article rows, major layout refactoring required, breaking existing component structure

**Why it happens:** Article row component tightly couples title + metadata with no extension points

**How to avoid:**
- Design ArticleRow component with a reserved slot for future content (even if empty div in Phase 2)
- Use Chakra's Stack component with defined spacing that can accommodate additional row
- Consider collapsible/expandable design pattern from the start
- Document in component comments where LLM summary will be inserted

**Warning signs:** ArticleRow component has no extensibility, hardcoded heights that will break with extra content

**Context:** User explicitly requested "Reserve layout space for future LLM reasoning/summary display (Phase 5)"

## Code Examples

Verified patterns from official sources:

### Custom Theme with Orange Accent

```typescript
// src/theme/index.ts
import { createSystem, defaultConfig } from '@chakra-ui/react'

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#FFF4E6' },
          100: { value: '#FFE0B2' },
          200: { value: '#FFCC80' },
          300: { value: '#FFB74D' },
          400: { value: '#FFA726' },
          500: { value: 'oklch(64.6% 0.222 41.116)' }, // Primary orange
          600: { value: '#FB8C00' },
          700: { value: '#F57C00' },
          800: { value: '#EF6C00' },
          900: { value: '#E65100' },
        },
      },
    },
    semanticTokens: {
      colors: {
        accent: {
          default: { value: '{colors.brand.500}' },
          _dark: { value: '{colors.brand.400}' },
        },
      },
    },
  },
})
```

### Typography Configuration

```typescript
// src/theme/typography.ts
import { defineTextStyles } from '@chakra-ui/react'

export const textStyles = defineTextStyles({
  // UI text (sans-serif)
  body: {
    value: {
      fontFamily: 'var(--font-geist-sans)',
      fontSize: '16px',
      lineHeight: '1.6',
    },
  },
  // Reader content (serif)
  'reader.body': {
    value: {
      fontFamily: 'Georgia, serif',
      fontSize: { base: '18px', md: '20px' },
      lineHeight: '1.8',
      letterSpacing: '0.01em',
    },
  },
  'reader.heading': {
    value: {
      fontFamily: 'Georgia, serif',
      fontSize: { base: '28px', md: '32px' },
      lineHeight: '1.3',
      fontWeight: 'bold',
    },
  },
})
```

### Article Row Component

```typescript
// src/components/article/ArticleRow.tsx
'use client'

import { Box, HStack, Text, VStack } from '@chakra-ui/react'
import { useAutoMarkAsRead } from '@/hooks/useMarkAsRead'
import { useMarkAsRead } from '@/hooks/useArticles'

interface ArticleRowProps {
  article: {
    id: string
    title: string
    source: string
    date: string
    isRead: boolean
  }
  onClick: () => void
}

export function ArticleRow({ article, onClick }: ArticleRowProps) {
  const markAsRead = useMarkAsRead()
  const ref = useAutoMarkAsRead(article.id, () => {
    if (!article.isRead) {
      markAsRead.mutate(article.id)
    }
  })

  return (
    <Box
      ref={ref}
      onClick={onClick}
      p={4}
      borderBottom="1px"
      borderColor="border.subtle"
      opacity={article.isRead ? 0.6 : 1}
      cursor="pointer"
      transition="opacity 0.2s"
      _hover={{ bg: 'bg.subtle' }}
    >
      <VStack align="stretch" gap={2}>
        <HStack justify="space-between" align="start">
          <Text
            fontSize="lg"
            fontWeight="medium"
            noOfLines={1}
            flex={1}
          >
            {article.title}
          </Text>
          {!article.isRead && (
            <Box
              w={2}
              h={2}
              bg="accent"
              borderRadius="full"
              flexShrink={0}
            />
          )}
        </HStack>

        {/* Reserved space for future LLM summary (Phase 5) */}
        <Box minH={0} />

        <HStack gap={3} fontSize="sm" color="text.muted">
          <Text>{article.source}</Text>
          <Text>•</Text>
          <Text>{article.date}</Text>
        </HStack>
      </VStack>
    </Box>
  )
}
```

### TanStack Query Setup

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      gcTime: 5 * 60_000, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// src/app/providers.tsx
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { Provider as ChakraProvider } from '@/components/ui/provider'
import { queryClient } from '@/lib/queryClient'

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider>{children}</ChakraProvider>
    </QueryClientProvider>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chakra UI v2 | Chakra UI v3 | Q1 2024 | Built-in next-themes integration, RSC-compatible by default, improved performance (4x reconciliation, 1.6x re-render), dot notation imports |
| Custom color mode | next-themes via Provider | Chakra v3 | Eliminates manual localStorage handling, SSR hydration issues, flash prevention |
| TanStack Query v4 | TanStack Query v5 | 2024 | Better RSC support, suspense integration, renamed `cacheTime` to `gcTime` |
| Manual scroll listeners | Intersection Observer | 2019+ | Non-blocking, async, better performance, native browser API |
| CSS-in-JS (styled-components, emotion) | Chakra semantic tokens | Ongoing | Automatic theme adaptation, reduced bundle size, better tree-shaking |

**Deprecated/outdated:**
- Chakra UI v2 color mode (`useColorMode` directly): Now wrapped by next-themes in v3
- `@chakra-ui/next-js` package: No longer needed in v3, functionality moved to core
- Infinite scroll libraries (react-infinite-scroll, react-window): User explicitly wants "load more" button
- Custom theme flash prevention scripts: Handled automatically by next-themes integration

## Open Questions

Things that couldn't be fully resolved:

1. **Backend Article Content API Shape**
   - What we know: Backend uses SQLite with article table (from Phase 1)
   - What's unclear: Exact API response format, whether full content is stored or fetched on-demand
   - Recommendation: Define API contract with backend team before implementing ArticleReader component, ensure it includes: id, title, source, date, content (HTML or markdown), url, isRead

2. **Article Content Sanitization**
   - What we know: Need to render article content in-app with clean typography
   - What's unclear: Whether backend sanitizes HTML, or frontend needs DOMPurify or similar
   - Recommendation: Verify with backend team if HTML sanitization happens server-side; if not, add `dompurify` to frontend stack for XSS prevention

3. **Image Handling in Reader**
   - What we know: User wants images displayed but constrained (max width/height)
   - What's unclear: Whether images should be lazy-loaded, proxied through backend, or linked directly from source
   - Recommendation: Use Next.js Image component with unoptimized prop for external URLs, set maxW="100%" maxH="600px" constraints, consider lazy loading with Intersection Observer for images below fold

## Sources

### Primary (HIGH confidence)

- [Chakra UI v3 Installation](https://chakra-ui.com/docs/get-started/installation) - Setup steps, package requirements
- [Chakra UI v3 Next.js App Router Guide](https://chakra-ui.com/docs/get-started/frameworks/next-app) - Next.js integration, provider setup
- [Chakra UI v3 Drawer Component](https://chakra-ui.com/docs/components/drawer) - Component API, usage patterns
- [Chakra UI v3 Dark Mode](https://chakra-ui.com/docs/styling/dark-mode) - Theme toggle, semantic tokens, next-themes integration
- [MDN Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) - Viewport detection, timing element visibility
- [TanStack Query v5 Documentation](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) - Server state management, SSR patterns

### Secondary (MEDIUM confidence)

- [React Server Components + TanStack Query 2026](https://dev.to/krish_kakadiya_5f0eaf6342/react-server-components-tanstack-query-the-2026-data-fetching-power-duo-you-cant-ignore-21fj) - Architecture patterns, performance impact
- [React Pagination Tutorial](https://hygraph.com/blog/react-pagination) - Load more button implementation
- [CSS Typography Best Practices](https://pimpmytype.com/line-length-line-height/) - Line height, line length for readability
- [Typography Best Practices Guide 2025](https://www.adoc-studio.app/blog/typography-guide) - Font sizes, spacing, serif vs sans-serif
- [localStorage vs sessionStorage React](https://medium.com/@shankavieducationalinstitute/leveraging-localstorage-and-sessionstorage-in-react-278698d42097) - Persistence strategies

### Tertiary (LOW confidence)

- [Material-UI Drawer Performance Issue](https://github.com/mui/material-ui/issues/31009) - Performance pitfalls (different library but similar patterns)
- [React Debounce Patterns](https://www.developerway.com/posts/debouncing-in-react) - Timer management patterns
- [UI Design Common Mistakes](https://www.toptal.com/designers/ui/most-common-ui-design-mistakes) - General UX pitfalls

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Chakra UI v3, TanStack Query, Intersection Observer all verified via official docs
- Architecture: HIGH - Patterns verified via Chakra UI official examples and Next.js documentation
- Pitfalls: MEDIUM - Some based on GitHub issues and community experience rather than official docs

**Research date:** 2026-02-05
**Valid until:** ~30 days (stable technologies, unlikely to change rapidly)
