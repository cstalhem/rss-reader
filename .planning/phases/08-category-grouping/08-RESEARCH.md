# Phase 8: Category Grouping - Research

**Researched:** 2026-02-15
**Domain:** Hierarchical category organization, cross-container drag-and-drop, cascading weight resolution
**Confidence:** HIGH

## Summary

Phase 8 transforms the flat category weight system into a hierarchical group-based structure. The core technical challenges are: (1) a new backend data model for category groups with cascading weight inheritance, (2) cross-container drag-and-drop using the already-installed `@dnd-kit/core` 6.3.1 and `@dnd-kit/sortable` 10.0.0, (3) a new "Categories" settings section with accordion-based group UI, and (4) updating the scoring pipeline to resolve effective weights through the group hierarchy.

The codebase already has strong patterns to build on. The sidebar's feed reordering uses `@dnd-kit` with `useSortable`, the settings page uses a multi-panel card layout (visible in `OllamaSection`), the `DeleteFeedDialog` demonstrates Chakra v3 Dialog patterns, and `FeedRow` has the exact rename interaction to replicate for group renaming. The current weight system stores string-keyed weights (`"blocked" | "low" | "neutral" | "medium" | "high"`) in a JSON column on `UserPreferences.topic_weights`.

**Primary recommendation:** Add a new `category_groups` JSON column on `UserPreferences` (matching the existing single-row pattern), store group definitions and category-to-group mappings there, and update `compute_composite_score` to resolve effective weights via the three-tier priority chain: explicit category override > group default > neutral (1.0).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tree Interaction:**
- Collapsible accordion structure -- each group is an expandable card, categories listed inside
- Select + group action for creating groups -- user checks multiple categories, clicks "Group selected", names the group in a small popover dialog
- Drag-and-drop to move categories between groups (primary reorganization method)
- Drag-and-drop from ungrouped flat list into existing group accordions
- Groups are alphabetically auto-sorted (no manual reorder)
- Group rename follows the same interaction pattern as feed names in the sidebar
- Delete group shows confirmation dialog, releases child categories back to ungrouped
- Individual categories (grouped or ungrouped) can be removed/hidden

**Weight UX:**
- 5 preset buttons: Block (0.0), Reduce (0.5), Normal (1.0), Boost (1.5), Max (2.0)
- Replaces the existing +/- weight buttons entirely (clean break)
- Group weight presets sit in the accordion header (always visible even when collapsed)
- Category weight presets sit inline next to each category row
- Default state is inherited (from group) -- no special indicator for inherited
- Overridden categories show a visual indicator ("Overridden" label or accent-color buttons) plus a reset-to-inherited action
- Ungrouped categories always have settable weights, default to Normal (1.0)

**Ungrouped Categories:**
- Flat list below group accordions with "Ungrouped" subsection heading (muted style matching Ollama subsections)
- Categories in the ungrouped list are selectable (checkboxes) for grouping and also draggable into existing groups
- Every ungrouped category has its own weight preset buttons, defaulting to Normal

**New Category Flow:**
- New categories from LLM scoring appear in ungrouped list with a "New" labeled chip badge
- Previously removed categories that reappear get a "Returned" labeled chip badge
- Badges are dismissed by: setting a weight, grouping the category, or clicking/dismissing the badge directly
- Three-tier notification for new categories:
  1. Small round dot badge on the settings gear icon in the main UI (no count)
  2. Count badge on the "Categories" sidebar item in settings (positioned like the Ollama download indicator)
  3. Count badge next to the "Topic Categories" panel heading inside the Categories section

**Settings Design:**
- Current "Interests" section splits into two separate settings sidebar entries:
  - **Interests** -- Interest description text areas (what you care about, what to avoid)
  - **Categories** -- Category groups, ungrouped categories, weight presets
- Settings sidebar order: Feeds > Interests > Categories > Ollama > Feedback (5 items)
- Categories section uses the multi-panel card pattern (matching Ollama's style)
- "Group selected" button lives in the Topic Categories panel header
- Categories panel contains both group accordions and ungrouped flat list

### Claude's Discretion
- Exact drag-and-drop library choice and implementation
- Accordion expand/collapse animation details
- Exact badge/chip styling and positioning within rows
- Popover layout for group naming dialog
- Empty state when no categories exist yet
- How "remove category" is triggered (icon button, context menu, etc.)

### Deferred Ideas (OUT OF SCOPE)
- LLM-suggested weights based on feedback patterns -- Phase 9 (Feedback Loop)
- Category weight suggestions from interest alignment analysis -- Phase 9

</user_constraints>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 | Drag-and-drop framework | Already used for feed reordering in sidebar and FeedsSection |
| `@dnd-kit/sortable` | 10.0.0 | Sortable lists within DnD contexts | Already used for feed lists |
| `@dnd-kit/utilities` | 3.2.2 | CSS transform utilities | Already used by FeedRow |
| `@chakra-ui/react` | 3.32.0 | UI component library | Project standard -- Accordion, SegmentGroup, Popover, Checkbox, Dialog all available |
| `@tanstack/react-query` | 5.90.20 | Server state management | Project standard for all API data |
| `react-icons` | 5.5.0 | Icon library (lucide set) | Project standard |

### No New Dependencies Required

The existing stack covers all requirements:
- **Cross-container DnD**: `@dnd-kit/core` provides `useDroppable`, `DragOverlay`, `onDragOver`, `onDragEnd`, `closestCorners` collision detection
- **Accordion groups**: Chakra v3 `Accordion` (via Ark UI) supports `collapsible` and `multiple` props
- **Weight presets**: Chakra v3 `SegmentGroup` provides the segmented-control feel the user wants
- **Checkboxes**: Chakra v3 `Checkbox` for selection in ungrouped list
- **Group naming popover**: Chakra v3 `Popover` with Portal/Positioner pattern
- **Delete confirmation**: Chakra v3 `Dialog` (same pattern as `DeleteFeedDialog`)

## Architecture Patterns

### Data Model Design

The current system stores category weights as a flat `topic_weights: dict[str, str]` JSON column on `UserPreferences`. This phase needs to add group structure while preserving backward compatibility.

**Recommended approach:** Add a new `category_groups` JSON column to `UserPreferences` containing the full group/category hierarchy. Keep `topic_weights` for individual category weight overrides (explicit overrides and ungrouped weights). This avoids a new table and stays consistent with the single-row preferences pattern.

```python
# UserPreferences.category_groups JSON structure:
{
  "groups": [
    {
      "id": "grp-uuid",
      "name": "Programming",
      "weight": "boost",           # Group-level weight preset
      "categories": ["python", "rust", "web-development"]
    },
    {
      "id": "grp-uuid2",
      "name": "News",
      "weight": "normal",
      "categories": ["politics", "business", "finance"]
    }
  ],
  "hidden_categories": ["celebrity-gossip", "sports"],  # Removed/hidden categories
  "seen_categories": ["python", "rust", ...]            # Track which have been acknowledged (dismiss "New" badge)
}

# UserPreferences.topic_weights stays as-is for explicit overrides:
{
  "python": "max",       # Explicit override within "Programming" group
  "politics": "reduce",  # Explicit override within "News" group
  "ai-ml": "boost"       # Ungrouped category with explicit weight
  # Categories NOT in this dict inherit from group or default to "normal"
}
```

**Weight resolution priority (in compute_composite_score):**
1. `topic_weights[category]` if present (explicit override) -> use this weight
2. Group weight for the group containing this category -> use group weight
3. Default -> "normal" (1.0)

### Weight Preset Mapping (New)

The context specifies new weight names and values:

| Old Name | New Name | Numeric Value |
|----------|----------|---------------|
| blocked  | Block    | 0.0           |
| low      | Reduce   | 0.5           |
| neutral  | Normal   | 1.0           |
| medium   | Boost    | 1.5           |
| high     | Max      | 2.0           |

**Backend migration:** The string keys stored in `topic_weights` need to change from `"blocked"/"low"/"neutral"/"medium"/"high"` to `"block"/"reduce"/"normal"/"boost"/"max"`. The `weight_map` in `scoring.py:compute_composite_score` must be updated, and existing data must be migrated.

### Frontend Component Structure

```
frontend/src/components/settings/
  InterestsSection.tsx       # MODIFIED: Remove categories, keep only text areas
  CategoriesSection.tsx      # NEW: Main categories section
  CategoryGroupAccordion.tsx # NEW: Expandable group with header weight presets
  CategoryRow.tsx            # NEW: Single category row with weight presets
  UngroupedCategories.tsx    # NEW: Flat list below groups
  GroupNamePopover.tsx       # NEW: Popover for naming new groups
  DeleteGroupDialog.tsx      # NEW: Confirmation dialog for deleting groups
  WeightPresets.tsx          # NEW: Reusable SegmentGroup for weight presets
  SettingsSidebar.tsx        # MODIFIED: Add "categories" section, update type

frontend/src/hooks/
  useCategories.ts           # NEW: Category groups state management hook
```

### Recommended Project Structure for New Components

```
CategoriesSection
  |-- Topic Categories Panel (bg.subtle card, matching Ollama panels)
  |   |-- Panel header with "Topic Categories" + count badge + "Group selected" button
  |   |-- DndContext (wraps everything below)
  |   |   |-- CategoryGroupAccordion (per group)
  |   |   |   |-- Accordion header: group name + rename + weight presets + delete
  |   |   |   |-- Accordion body: SortableContext with CategoryRow items
  |   |   |-- UngroupedCategories section heading
  |   |   |-- SortableContext for ungrouped items
  |   |   |   |-- CategoryRow (with checkbox + weight presets + drag handle)
  |   |-- GroupNamePopover (triggered by "Group selected" button)
  |   |-- DeleteGroupDialog
```

### Pattern 1: Cross-Container Drag-and-Drop with dnd-kit

**What:** Moving categories between groups and from ungrouped into groups.
**When to use:** This is the primary reorganization method per the locked decisions.

The key insight is that dnd-kit's `SortableContext` handles reordering within a single list, but for moving items between lists, you need:
1. `useDroppable` on each container (group accordion body + ungrouped list)
2. `DragOverlay` for the visual drag preview
3. `onDragStart` to capture which container the item came from
4. `onDragOver` to detect when an item crosses into a different container
5. `onDragEnd` to finalize the move

```typescript
// Source: @dnd-kit/core 6.3.1 API (verified from installed types)
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

// Each group accordion body is a droppable container:
function DroppableGroup({ groupId, categoryIds, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId });
  return (
    <Box ref={setNodeRef} bg={isOver ? "bg.muted" : undefined}>
      <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </Box>
  );
}

// The ungrouped section is also a droppable container:
function DroppableUngrouped({ categoryIds, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: "ungrouped" });
  return (
    <Box ref={setNodeRef}>
      <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </Box>
  );
}

// In the parent DndContext:
// - onDragOver: detect container change, update local state optimistically
// - onDragEnd: persist the final container assignment to API
// - Use closestCorners collision detection (better for multi-container than closestCenter)
```

**Important:** Use `closestCorners` (not `closestCenter`) for multi-container scenarios -- it better detects when dragging over a container boundary.

### Pattern 2: Chakra v3 Accordion for Group Cards

**What:** Collapsible group cards with weight presets visible in the header.
**When to use:** Each category group is rendered as an Accordion item.

```typescript
// Source: Chakra UI v3 Accordion (via Ark UI, verified from installed types)
import { Accordion } from "@chakra-ui/react";

// Accordion.Root supports `multiple` (allow multiple open) and `collapsible` (allow all closed)
<Accordion.Root multiple collapsible defaultValue={[]}>
  {groups.map(group => (
    <Accordion.Item key={group.id} value={group.id}>
      <Accordion.ItemTrigger>
        <Flex flex={1} alignItems="center" justifyContent="space-between">
          <Text>{group.name}</Text>
          {/* Weight presets in header -- always visible */}
          <WeightPresets value={group.weight} onChange={...} onClick={e => e.stopPropagation()} />
        </Flex>
        <Accordion.ItemIndicator />
      </Accordion.ItemTrigger>
      <Accordion.ItemContent>
        <Accordion.ItemBody>
          {/* Droppable container with category rows */}
          <DroppableGroup groupId={group.id} categoryIds={group.categories}>
            {group.categories.map(cat => <CategoryRow key={cat} ... />)}
          </DroppableGroup>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  ))}
</Accordion.Root>
```

**Note:** The weight presets in the accordion header need `onClick={e => e.stopPropagation()}` to prevent toggling the accordion when clicking preset buttons.

### Pattern 3: SegmentGroup for Weight Presets

**What:** The 5 weight buttons (Block, Reduce, Normal, Boost, Max) as a segmented control.
**When to use:** Inline on every category row and in every group header.

```typescript
// Source: Chakra UI v3 SegmentGroup (verified from installed types)
import { SegmentGroup } from "@chakra-ui/react";

function WeightPresets({ value, onChange, isInherited, onReset }) {
  return (
    <Flex alignItems="center" gap={2}>
      <SegmentGroup.Root
        value={value}
        onValueChange={({ value }) => onChange(value)}
        size="xs"
      >
        <SegmentGroup.Indicator />
        <SegmentGroup.Items
          items={[
            { value: "block", label: "Block" },
            { value: "reduce", label: "Reduce" },
            { value: "normal", label: "Normal" },
            { value: "boost", label: "Boost" },
            { value: "max", label: "Max" },
          ]}
        />
      </SegmentGroup.Root>
      {isInherited === false && (
        <IconButton size="xs" variant="ghost" onClick={onReset} aria-label="Reset to inherited">
          <LuUndo2 />
        </IconButton>
      )}
    </Flex>
  );
}
```

**Alternative if SegmentGroup is too wide:** Fall back to compact `Button` group with `variant="solid"` for active and `variant="ghost"` for inactive (matching the existing pattern in `InterestsSection`). The SegmentGroup may be too wide at `size="xs"` to fit inline on category rows. Test both approaches and pick the one that fits.

### Pattern 4: Popover for Group Naming

**What:** Small popover dialog triggered by "Group selected" button.
**When to use:** When user selects categories and clicks "Group selected".

```typescript
// Source: Chakra UI v3 Popover (follows Portal/Positioner pattern per project conventions)
import { Popover, Portal } from "@chakra-ui/react";

<Popover.Root>
  <Popover.Trigger asChild>
    <Button size="sm" disabled={selectedCategories.length === 0}>
      Group selected
    </Button>
  </Popover.Trigger>
  <Portal>
    <Popover.Positioner>
      <Popover.Content>
        <Popover.Body>
          <Field label="Group name">
            <Input value={groupName} onChange={...} placeholder="e.g., Programming" />
          </Field>
          <Button onClick={handleCreateGroup} mt={2}>Create</Button>
        </Popover.Body>
      </Popover.Content>
    </Popover.Positioner>
  </Portal>
</Popover.Root>
```

### Pattern 5: Feed Rename Interaction for Groups

**What:** Double-click (desktop) / long-press (mobile) to enter inline rename mode.
**When to use:** Group rename in accordion header.

The exact pattern is in `FeedRow.tsx` (lines 62-114). Key elements:
- `isRenaming` state, `renameValue` state, `inputRef`
- `useEffect` to auto-focus and select text when entering rename mode
- Double-click handler on the text element
- Submit on Enter, cancel on Escape, submit on blur
- Long-press via setTimeout for mobile
- Inline `<input>` replacing the `<Text>` element with transparent background

### Anti-Patterns to Avoid

- **Separate database table for groups:** Adds complexity without benefit for a single-user app. Keep groups in JSON column on UserPreferences.
- **Storing resolved numeric weights:** Store preset strings ("block", "boost", etc.) and resolve to numbers at scoring time. This keeps the data human-readable and the resolution logic in one place.
- **Mutating JSON columns in-place:** SQLAlchemy does NOT detect in-place mutations to JSON columns. Always reassign: `preferences.category_groups = {**new_data}`.
- **Using `closestCenter` for multi-container DnD:** Use `closestCorners` instead -- it handles container boundary detection better.
- **Putting weight presets inside the accordion content:** Group weight presets must be in the header (visible when collapsed). Use `stopPropagation` to prevent accordion toggle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop between containers | Custom mouse event handlers | `@dnd-kit/core` `useDroppable` + `DragOverlay` | Handles keyboard accessibility, touch, scroll, collision detection |
| Segmented toggle control | Custom button group with active state management | Chakra v3 `SegmentGroup` (if sizing works) or existing button pattern | Handles ARIA, keyboard nav, indicator animation |
| Collapsible sections | Custom show/hide with state | Chakra v3 `Accordion` | Handles animation, ARIA, keyboard, multiple/collapsible modes |
| UUID generation for group IDs | Custom ID generator | `crypto.randomUUID()` (browser API) | Universally available in modern browsers |
| Popover with form | Custom positioned overlay | Chakra v3 `Popover` with Portal pattern | Handles positioning, focus trap, dismiss on outside click |

## Common Pitfalls

### Pitfall 1: Accordion Header Click Conflicts

**What goes wrong:** Clicking weight preset buttons in the accordion header toggles the accordion open/closed.
**Why it happens:** The accordion trigger captures all click events within it.
**How to avoid:** Place weight presets OUTSIDE the `Accordion.ItemTrigger` but still in the visual header area. Or use `e.stopPropagation()` on the preset container. The safest approach is to build a custom header `Flex` that contains the trigger text and the presets side by side, with only the text wrapped in `Accordion.ItemTrigger`.
**Warning signs:** Accordion toggling when clicking weight buttons.

### Pitfall 2: DnD Context Nesting

**What goes wrong:** Having multiple `DndContext` providers (one per group) breaks cross-container dragging.
**Why it happens:** Each `DndContext` is independent -- items cannot be dragged between separate contexts.
**How to avoid:** Use a SINGLE `DndContext` wrapping all groups and the ungrouped list. Each group uses `useDroppable` to register as a droppable container, and each category uses `useSortable` within its respective `SortableContext`.
**Warning signs:** Items can only be reordered within their group but not moved between groups.

### Pitfall 3: SQLAlchemy JSON Column Mutation Detection

**What goes wrong:** Updating a nested key in `category_groups` or `topic_weights` silently fails to persist.
**Why it happens:** SQLAlchemy tracks object identity, not deep mutations. `prefs.category_groups["groups"][0]["weight"] = "boost"` is invisible.
**How to avoid:** Always build a new dict/list and reassign: `prefs.category_groups = deep_copy_with_changes`.
**Warning signs:** Changes appear to work in-memory but are lost after page refresh.

### Pitfall 4: Weight Migration Data Loss

**What goes wrong:** Existing `topic_weights` entries use old key names ("blocked"/"low"/"neutral"/"medium"/"high") that don't match the new names ("block"/"reduce"/"normal"/"boost"/"max").
**Why it happens:** The new `weight_map` in `compute_composite_score` uses the new names but the stored data still has old names.
**How to avoid:** Add a migration step in `database.py` that maps old weight strings to new ones. Run it on startup alongside other migrations. Also keep backward compatibility in `weight_map` during transition.
**Warning signs:** All categories suddenly default to "normal" (1.0) after the update.

### Pitfall 5: Stale Category Discovery

**What goes wrong:** The "New" badge logic doesn't work because there's no way to distinguish truly new categories from ones that existed before this feature.
**Why it happens:** No historical tracking of which categories the user has seen.
**How to avoid:** When the feature first activates, seed `seen_categories` in `category_groups` with ALL currently known categories. Only categories discovered after that point get the "New" badge.
**Warning signs:** Every existing category shows a "New" badge on first load after the update.

### Pitfall 6: Drag Preview During Accordion Collapse

**What goes wrong:** Dragging a category while its group accordion is animating open/closed causes visual glitches.
**Why it happens:** The `DragOverlay` renders a clone, but the original element's position changes during the accordion animation.
**How to avoid:** Use `DragOverlay` with a custom rendered clone (not tied to the original element's position). Disable accordion toggle during active drag.
**Warning signs:** Drag preview jumps or disappears during accordion animation.

## Code Examples

### Backend: Effective Weight Resolution

```python
# Updated compute_composite_score with group weight resolution
def compute_composite_score(
    interest_score: int,
    quality_score: int,
    categories: list[str],
    topic_weights: dict[str, str] | None,
    category_groups: dict | None,
) -> float:
    """Compute composite score with hierarchical weight resolution.

    Weight resolution priority:
    1. topic_weights[category] -- explicit override
    2. Group weight for the group containing category
    3. "normal" (1.0) default
    """
    weight_map = {
        "block": 0.0,
        "reduce": 0.5,
        "normal": 1.0,
        "boost": 1.5,
        "max": 2.0,
    }

    if not categories:
        category_multiplier = 1.0
    else:
        # Build category -> group_weight lookup
        group_weights = {}
        if category_groups and "groups" in category_groups:
            for group in category_groups["groups"]:
                for cat in group.get("categories", []):
                    group_weights[cat.lower()] = group.get("weight", "normal")

        weights = []
        for category in categories:
            cat_lower = category.lower()
            # Priority 1: explicit override
            if topic_weights and cat_lower in topic_weights:
                weight_str = topic_weights[cat_lower]
            # Priority 2: group weight
            elif cat_lower in group_weights:
                weight_str = group_weights[cat_lower]
            # Priority 3: default
            else:
                weight_str = "normal"
            weights.append(weight_map.get(weight_str, 1.0))

        category_multiplier = sum(weights) / len(weights) if weights else 1.0

    quality_multiplier = 0.5 + (quality_score / 10.0) * 0.5
    composite = interest_score * category_multiplier * quality_multiplier
    return min(composite, 20.0)
```

### Backend: New API Endpoints

```python
# New endpoints needed:
# PUT /api/categories/groups       - Save full group structure
# GET /api/categories/groups       - Get group structure
# PATCH /api/categories/{name}/hide    - Hide/remove a category
# PATCH /api/categories/{name}/unhide  - Unhide a category
# GET /api/categories/new-count    - Get count of unseen categories (for badges)
# POST /api/categories/acknowledge - Mark categories as seen (dismiss badges)
```

### Frontend: New Category Badge Notification

```typescript
// In Header.tsx - dot badge on settings gear
import { Circle } from "@chakra-ui/react";

// Fetch new category count
const { data: newCount } = useQuery({
  queryKey: ["categories", "new-count"],
  queryFn: fetchNewCategoryCount,
  refetchInterval: 30000, // Check every 30s
});

// Render dot badge
<Box position="relative">
  <Link href="/settings">
    <IconButton aria-label="Settings" size="sm" variant="ghost">
      <LuSettings />
    </IconButton>
  </Link>
  {newCount > 0 && (
    <Circle
      size="8px"
      bg="accent.solid"
      position="absolute"
      top="4px"
      right="4px"
    />
  )}
</Box>
```

### Frontend: Settings Sidebar with Count Badge

```typescript
// Updated SettingsSidebar with "categories" section and count badge
// Follows the same pattern as the Ollama download indicator
export type SettingsSection = "feeds" | "interests" | "categories" | "ollama" | "feedback";

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "feeds", icon: LuRss, label: "Feeds" },
  { id: "interests", icon: LuHeart, label: "Interests" },
  { id: "categories", icon: LuTag, label: "Categories" },
  { id: "ollama", icon: LuBot, label: "Ollama" },
  { id: "feedback", icon: LuMessageSquare, label: "Feedback" },
];

// Count badge on "Categories" item (same positioning as Ollama download indicator)
{item.id === "categories" && newCategoryCount > 0 && (
  <Badge ml="auto" colorPalette="accent" size="sm">
    {newCategoryCount}
  </Badge>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `topic_weights` dict | Hierarchical groups + overrides | This phase | Scoring pipeline needs group-aware weight resolution |
| Weight names: blocked/low/neutral/medium/high | Weight names: block/reduce/normal/boost/max | This phase | Data migration needed, but values (0.0-2.0) stay the same |
| Single "Interests" settings section | Split into "Interests" + "Categories" | This phase | Settings sidebar gets 5 items, page component needs new section |
| Categories sourced from articles only | Categories tracked with seen/hidden state | This phase | New `category_groups` JSON field, new API endpoints |

**Key version notes:**
- `@dnd-kit/sortable` 10.0.0 is a major version -- the API is stable and matches the patterns used in the existing codebase
- Chakra UI v3 Accordion uses Ark UI under the hood with `multiple` and `collapsible` props
- `SegmentGroup` is a Chakra v3 component (via Ark UI) -- verify sizing works inline before committing to it

## Open Questions

1. **SegmentGroup sizing for inline weight presets**
   - What we know: Chakra v3 has `SegmentGroup` with `size="xs"` variant
   - What's unclear: Whether 5 items at xs size fit within a category row alongside the category name and drag handle
   - Recommendation: Build WeightPresets component early, test with SegmentGroup first. Fall back to compact Button group (matching existing pattern) if too wide. The Button group pattern from current InterestsSection already works and is proven.

2. **Accordion header layout with weight presets**
   - What we know: Presets must be visible even when collapsed, must not trigger accordion toggle
   - What's unclear: Exact Chakra v3 Accordion structure for putting interactive elements in the header without conflicts
   - Recommendation: Build a custom Flex header with the AccordionItemTrigger wrapping only the expandable part (name + indicator), not the weight presets. Test that `stopPropagation` on preset clicks works.

3. **"Returned" category detection**
   - What we know: Categories removed/hidden by user can reappear if the LLM rediscovers them
   - What's unclear: How to reliably detect this -- does it happen during scoring or during category list assembly?
   - Recommendation: During scoring, after categorization step, check if any assigned category is in `hidden_categories`. If so, add it to a `returned_categories` list in `category_groups` and unhide it. The frontend picks this up on next data fetch.

## Sources

### Primary (HIGH confidence)
- **Installed packages** -- `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0 type definitions verified from `node_modules`
- **Installed packages** -- `@chakra-ui/react` 3.32.0 Accordion, SegmentGroup, Popover, Checkbox, Dialog namespace exports verified from type definitions
- **Codebase** -- `Sidebar.tsx`, `FeedRow.tsx`, `FeedsSection.tsx` for existing dnd-kit patterns
- **Codebase** -- `OllamaSection.tsx` for multi-panel card layout pattern
- **Codebase** -- `DeleteFeedDialog.tsx` for Chakra v3 Dialog pattern with Portal/Positioner
- **Codebase** -- `scoring.py:compute_composite_score` for current weight resolution logic
- **Codebase** -- `models.py:UserPreferences` for current schema
- **Codebase** -- `database.py` for migration pattern (ALTER TABLE on startup)
- **Codebase** -- `main.py` for API endpoint patterns

### Secondary (MEDIUM confidence)
- **Ark UI Accordion** -- `collapsible` and `multiple` props confirmed from installed `@ark-ui/react` source
- **dnd-kit multi-container** -- `useDroppable` + `closestCorners` pattern is well-established in dnd-kit documentation; verified exports exist in installed version

### Tertiary (LOW confidence)
- **SegmentGroup inline sizing** -- Not tested at xs size with 5 items. May need fallback to Button group pattern.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and patterns proven in codebase
- Architecture: HIGH -- Data model follows established UserPreferences JSON column pattern; API follows existing endpoint patterns
- Pitfalls: HIGH -- Most are verified from direct codebase analysis (JSON mutation, DnD context nesting)
- DnD multi-container: MEDIUM -- Pattern is well-known but not yet used in this codebase; first cross-container DnD implementation
- SegmentGroup fit: LOW -- Untested for this specific layout

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable stack, no expected breaking changes)
