---
name: file-organization
description: Frontend file organization — lib/ file boundaries (types vs api vs utils vs constants), constant placement decisions, and "where does this go?" decision aid
---

# File Organization

Deep reference for where frontend code lives. For concise rules, see `.claude/rules/frontend.md`.

## Key Patterns

### `lib/` File Boundaries

| File             | Contains                                      | Does NOT contain                        |
| ---------------- | --------------------------------------------- | --------------------------------------- |
| `types.ts`       | Interfaces, type aliases, enums               | Runtime functions, API calls            |
| `api.ts`         | Fetch functions, `API_BASE_URL`               | Type definitions (import from types.ts) |
| `utils.ts`       | Pure runtime functions (parsers, formatters)  | Types (import from types.ts)            |
| `constants.ts`   | Cross-file named constants (used in 2+ files) | Single-file constants                   |
| `queryKeys.ts`   | Query key factory object                      | Query logic, mutations                  |
| `queryClient.ts` | QueryClient instance, MutationCache           | Query key definitions                   |

**Why these boundaries matter:** When `api.ts` has type definitions mixed in with fetch functions, or `types.ts` has runtime functions, it's unclear where to look for things and creates awkward import chains. Keep them separated: types compile away, functions run at runtime.

**Rule of thumb:** If it compiles away (types/interfaces), it goes in `types.ts`. If it runs at runtime, it goes in `utils.ts` (pure) or `api.ts` (side-effecting).

### Constants: Cross-File vs Single-File

**Cross-file constants** (used in 2+ files) live in `lib/constants.ts`:

```typescript
export const HEADER_HEIGHT = "64px";
export const SIDEBAR_WIDTH_COLLAPSED = "48px";
export const SIDEBAR_WIDTH_EXPANDED = "240px";
export const NEW_COUNT_POLL_INTERVAL = 30_000;
export const HIGH_SCORE_THRESHOLD = 15;
```

**Single-file constants** (used in one file) live at the top of that file:

```typescript
// In useScoringStatus.ts
const SCORING_STATUS_ACTIVE_INTERVAL = 2_500;
const SCORING_STATUS_IDLE_INTERVAL = 30_000;
```

**Why not put everything in constants.ts?** It would become a dumping ground. Constants like `SCORING_STATUS_ACTIVE_INTERVAL` are implementation details of one hook — they have no business being importable by other files. Co-location keeps the constant next to its only consumer.

### Export Discipline: `API_BASE_URL`

`API_BASE_URL` is exported from `api.ts` and imported by consumers (e.g., `useModelPull.ts`). The general rule: if a value is needed in 2+ files, export it from the canonical source rather than duplicating it.

## Anti-Patterns

### Mixing Types and Runtime Code

```typescript
// BAD — types.ts has a runtime function
export function parseSortOption(value: string): SortOption { ... }

// GOOD — types.ts has the type, utils.ts has the function
// types.ts:
export type SortOption = "score" | "date";
// utils.ts:
import { SortOption } from "./types";
export function parseSortOption(value: string): SortOption { ... }
```

### Magic Numbers

```typescript
// BAD
refetchInterval: 30000;
article.composite_score >= 15;
article.categories.slice(0, 3);

// GOOD
refetchInterval: NEW_COUNT_POLL_INTERVAL; // cross-file, lib/constants.ts
article.composite_score >= HIGH_SCORE_THRESHOLD; // cross-file, lib/constants.ts
article.categories.slice(0, MAX_VISIBLE_TAGS); // single-file, top of ArticleRow.tsx
```

## Decision Aids

### "Where does this new thing go?"

1. **New interface or type** → `types.ts`
2. **New fetch/API function** → `api.ts`
3. **New pure helper** (parser, formatter, validator) → `utils.ts`
4. **New constant used in 2+ files** → `constants.ts`
5. **New constant used in 1 file** → top of that file as `const`
6. **New query key** → add to `queryKeys.ts` factory
7. **New custom hook** → `hooks/useXxx.ts`
8. **New shared UI primitive** → `components/ui/xxx.tsx`
