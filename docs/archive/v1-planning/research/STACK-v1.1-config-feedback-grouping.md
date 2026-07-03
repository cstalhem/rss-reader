# Stack Research: v1.1 Configuration, Feedback & Category Grouping

**Domain:** RSS Reader — Ollama Config UI, UI Polish, LLM Feedback Loop, Category Grouping
**Researched:** 2026-02-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.1 features require **minimal stack additions**. Only one new frontend library (`dnd-kit-sortable-tree`) is needed for category grouping drag-and-drop. All other functionality leverages the existing validated stack (FastAPI, SQLModel, SQLite, Next.js, Chakra UI v3, Ollama, httpx).

**Key findings:**
- Ollama config UI needs NO new libraries — existing `ollama` Python package (v0.6.1) provides `.list()` and `.show()` methods
- Feedback loop avoids LLM fine-tuning complexity — uses weight adjustment strategy instead
- Category grouping uses nested JSON in SQLite with dnd-kit-sortable-tree for UI
- Configuration reload uses standard `lru_cache.cache_clear()` pattern

---

## Feature 1: Ollama Configuration UI

### Backend — NO new dependencies required

The existing `ollama` Python package (v0.6.1, already in `pyproject.toml`) provides all necessary API methods:

| Method | Purpose | Response |
|--------|---------|----------|
| `ollama.list()` | List locally available models | Returns list with model names, sizes, modified dates |
| `ollama.show(model_name)` | Get model details | Returns parameters, template, system prompt, model family, quantization |
| Basic HTTP GET to `http://localhost:11434/` | Health check | 200 = running, connection refused = down |

**Implementation approach:**

```python
# New endpoints in backend/src/backend/main.py
import ollama
import httpx

@app.get("/api/ollama/models")
async def list_ollama_models():
    """List available Ollama models."""
    try:
        result = ollama.list()
        return {"models": result["models"]}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Ollama not reachable")

@app.get("/api/ollama/health")
async def check_ollama_health():
    """Check if Ollama server is running."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:11434/", timeout=2.0)
            return {"status": "connected", "healthy": response.status_code == 200}
    except Exception:
        return {"status": "disconnected", "healthy": False}

@app.put("/api/preferences/ollama")
async def update_ollama_config(settings: OllamaConfigUpdate):
    """Update Ollama model selections (persisted in UserPreferences or config)."""
    # Update database or config file
    get_settings.cache_clear()  # Force reload
    return {"updated": True}
```

**Configuration reload pattern:**

Runtime config updates require clearing the `@lru_cache` on `get_settings()`:

```python
from backend.config import get_settings

# Clear cache to force settings reload
get_settings.cache_clear()

# Next call will reload from env vars / YAML
settings = get_settings()
```

**Why no new dependencies:** The ollama Python library already wraps the REST API cleanly. httpx is already in the FastAPI ecosystem (likely transitive dependency from FastAPI itself).

**Sources:**
- [Ollama Python library](https://github.com/ollama/ollama-python) — API methods (MEDIUM confidence, official GitHub)
- [Ollama API list models endpoint](https://docs.ollama.com/api/tags) — REST API reference (HIGH confidence, official docs)
- [Ollama health checking patterns](https://github.com/ollama/ollama/issues/1378) — community discussion on health endpoints (LOW confidence, GitHub issue)
- [FastAPI Settings pattern](https://fastapi.tiangolo.com/advanced/settings/) — lru_cache pattern (HIGH confidence, official docs)

### Frontend — NO new dependencies required

Use existing TanStack Query + Chakra UI v3:

```typescript
// New hook: src/hooks/useOllamaModels.ts
export function useOllamaModels() {
  return useQuery({
    queryKey: ['ollama', 'models'],
    queryFn: async () => {
      const res = await fetch('/api/ollama/models');
      if (!res.ok) throw new Error('Ollama not reachable');
      return res.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });
}

// New settings component using Chakra Select, FormControl, etc.
```

**UI components:**
- Model selection: Chakra UI `Select.Root` + `Select.Item` (already available)
- Health indicator: Chakra UI `Badge` with colorPalette (green=connected, red=disconnected)
- Settings form: Chakra UI `Field`, `Input`, `Button` (all existing)

---

## Feature 2: UI & Theme Polish

### NO new dependencies required

All refinements use existing Chakra UI v3 design system. Focus on:

1. **Semantic token adjustments** in `frontend/src/theme/colors.ts`
2. **Spacing refinements** using Chakra's spacing scale
3. **Loading states** with `Skeleton` component (already available)
4. **Animations** using Emotion's `keyframes` helper (already available)
5. **Responsive breakpoints** via Chakra responsive props

**Example polish areas:**
- Refine ArticleRow padding from `py=3 px=4` to `py=3.5 px=5` for more breathing room
- Add `Skeleton` placeholders during article list loading
- Smooth transitions on read/unread state changes using Chakra `Transition` utilities
- Improve contrast ratios for accessibility (adjust semantic token values)

**Why no new libraries:** Chakra UI v3 is a complete design system. Polish is refinement, not new capabilities.

---

## Feature 3: LLM Feedback Loop

### Backend — NO new dependencies required

**New database model** (SQLModel in `backend/src/backend/models.py`):

```python
class ArticleFeedback(SQLModel, table=True):
    """User feedback on article scoring."""

    __tablename__ = "article_feedback"
    model_config = {"arbitrary_types_allowed": True}

    id: int | None = Field(default=None, primary_key=True)
    article_id: int = Field(foreign_key="articles.id", index=True, ondelete="CASCADE")
    feedback_type: str  # "thumbs_up", "thumbs_down", "score_adjustment"
    previous_score: float | None  # For audit trail
    adjusted_score: float | None  # User-set score override
    created_at: datetime = Field(default_factory=datetime.now)
```

**Feedback integration strategy:**

Rather than fine-tuning the LLM (resource-intensive, requires GPU, LoRA/QLoRA tooling, training datasets), use **feedback-adjusted category weights**:

1. Track which categories receive positive/negative feedback
2. Aggregate per category: `net_feedback = upvotes - downvotes`
3. Apply weight multipliers to categories in `UserPreferences.topic_weights`
4. Adjusted weights influence composite score calculation

**Weight adjustment formula:**

```python
def calculate_category_weight(base_weight: float, feedback_count: int) -> float:
    """Adjust weight based on feedback signals."""
    # Each net positive feedback adds 10%, net negative subtracts 10%
    # Clamped between 0.1 (minimum) and 2.0 (maximum)
    adjustment = 1.0 + (feedback_count * 0.1)
    return max(0.1, min(2.0, base_weight * adjustment))

# Example: category "tech" has base_weight=1.0
# User gives thumbs up to 3 "tech" articles, thumbs down to 1
# net_feedback = 3 - 1 = 2
# adjusted_weight = 1.0 * (1.0 + 2 * 0.1) = 1.2
# Future "tech" articles get 20% boost in composite score
```

**Storage in UserPreferences:**

```python
# Extend UserPreferences.topic_weights JSON column
{
  "tech": {
    "base": 1.0,
    "feedback_count": 2,  # net positive
    "effective": 1.2
  },
  "politics": {
    "base": 1.0,
    "feedback_count": -3,  # net negative
    "effective": 0.7
  }
}
```

**Why NOT fine-tuning:**
- **Complexity:** Fine-tuning requires LoRA adapters, training data preparation, GPU resources, model versioning
- **Overkill:** Full RLHF (Reinforcement Learning from Human Feedback) involves training reward models, policy optimization, PPO algorithms — inappropriate for single-user local app
- **Simpler alternative:** Weight adjustment achieves similar goals (boosting preferred content, suppressing disliked content) without model surgery
- **Performance:** No training time, instant feedback application, no additional compute requirements

**Sources:**
- [RLHF overview](https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback) — preference learning concepts (MEDIUM confidence, Wikipedia)
- [LLM fine-tuning guide](https://www.turing.com/resources/finetuning-large-language-models) — why PEFT/LoRA not suitable here (MEDIUM confidence, tutorial)
- [SQLite schema design for feedback](https://sqlite.org/forum/info/74f8fe97ed89f224207f00fc503f77b0b5b62de04f569588502210e1579a02c1) — voting/history patterns (MEDIUM confidence, official forum)

### Frontend — NO new dependencies required

**Feedback UI components** (all using existing libraries):

- **Thumbs up/down buttons:** `react-icons` (already in `package.json`) provides `FiThumbsUp`, `FiThumbsDown`
- **Score adjustment slider:** Chakra UI `Slider` component (already available)
- **Feedback confirmation:** Chakra UI `Toast` (already available)
- **Icon states:** Toggle between outline and solid icons to show active state

**UI pattern:**

```typescript
// Add to ArticleRow or ArticleReader
import { FiThumbsUp, FiThumbsDown } from 'react-icons/fi';

function FeedbackButtons({ articleId, currentFeedback }) {
  const feedbackMutation = useMutation({
    mutationFn: (type: 'thumbs_up' | 'thumbs_down') =>
      api.submitFeedback(articleId, type),
    onSuccess: () => {
      queryClient.invalidateQueries(['articles']);
      toast({ title: 'Feedback recorded', status: 'success' });
    },
  });

  return (
    <HStack>
      <IconButton
        aria-label="Thumbs up"
        icon={<FiThumbsUp />}
        size="sm"
        variant={currentFeedback === 'thumbs_up' ? 'solid' : 'ghost'}
        colorPalette="green"
        onClick={() => feedbackMutation.mutate('thumbs_up')}
      />
      <IconButton
        aria-label="Thumbs down"
        icon={<FiThumbsDown />}
        size="sm"
        variant={currentFeedback === 'thumbs_down' ? 'solid' : 'ghost'}
        colorPalette="red"
        onClick={() => feedbackMutation.mutate('thumbs_down')}
      />
    </HStack>
  );
}
```

**Best practices:**
- Allow users to **change their vote** (toggle thumbs up/down) — better reflects latest sentiment
- After thumbs down, optionally prompt "Why?" with category-specific options ("Too technical", "Not interesting") for more granular feedback
- Show visual confirmation (icon fill state change) immediately, then optimistically update

**Sources:**
- [Thumbs up/down survey patterns](https://www.zonkafeedback.com/blog/collecting-feedback-with-thumbs-up-thumbs-down-survey) — UX best practices (MEDIUM confidence, blog)
- [React feedback patterns 2026](https://www.freecodecamp.org/news/how-to-build-a-rating-component-with-the-react-compound-component-pattern/) — rating component patterns (LOW confidence, tutorial)

---

## Feature 4: Category Grouping

### Backend — NO new dependencies required

**Storage strategy:** Nested JSON in `UserPreferences` table (SQLite JSON column):

```json
{
  "category_groups": [
    {
      "id": "tech",
      "name": "Technology",
      "weight": 1.2,
      "children": [
        {"id": "ai", "name": "AI & ML", "weight": 1.5},
        {"id": "web-dev", "name": "Web Development", "weight": 1.0}
      ]
    },
    {
      "id": "science",
      "name": "Science",
      "weight": 1.0,
      "children": []
    }
  ],
  "category_overrides": {
    "specific-category": 0.5
  }
}
```

**Weight resolution logic:**

```python
def resolve_category_weight(
    category: str,
    category_groups: list[dict],
    category_overrides: dict[str, float]
) -> float:
    """Calculate effective weight for a category."""

    # 1. Check for explicit override
    if category in category_overrides:
        return category_overrides[category]

    # 2. Find category in hierarchy
    for group in category_groups:
        for child in group.get("children", []):
            if child["id"] == category:
                # Effective weight = parent_weight * child_weight
                return group["weight"] * child["weight"]

        # Check if category is a top-level group
        if group["id"] == category:
            return group["weight"]

    # 3. Default for ungrouped categories
    return 1.0
```

**SQLite JSON querying:**

Use SQLite's `json_tree()` function for querying nested structures if needed:

```sql
-- Find all categories in a specific group
SELECT value
FROM user_preferences,
     json_tree(user_preferences.category_groups, '$[*].children')
WHERE json_tree.key = 'id'
  AND json_tree.parent IN (SELECT id FROM json_tree(...) WHERE name = 'Technology');
```

However, **keep most logic in Python** for simplicity. SQLite JSON queries are powerful but complex. Python is easier to test, debug, and maintain.

**Sources:**
- [SQLite json_tree() function](https://sqlite.org/json1.html) — JSON hierarchy queries (HIGH confidence, official docs)
- [SQLite JSON best practices 2026](https://dadroit.com/blog/json-querying/) — querying patterns (MEDIUM confidence, tutorial)

### Frontend — ONE new dependency required

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **dnd-kit-sortable-tree** | Latest (check npm) | Hierarchical drag-and-drop category tree | Purpose-built for nested hierarchy with drag reordering, built on existing dnd-kit dependencies, accessible, smooth animations, TypeScript support |

**Installation:**

```bash
cd frontend
bun add dnd-kit-sortable-tree
```

**Why dnd-kit-sortable-tree:**
- Built on top of **existing** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (already in `package.json`)
- Designed specifically for tree hierarchies with drag-and-drop
- Active maintenance (successor to deprecated `react-sortable-tree`)
- Accessible (keyboard navigation, screen reader support)
- Smooth animations and drag previews

**Alternatives considered:**

| Library | Why NOT Used |
|---------|-------------|
| `react-sortable-tree` | Older, less active maintenance, not built on dnd-kit |
| `react-complex-tree` | More complex API, heavier bundle, overkill for simple category grouping |
| Custom dnd-kit implementation | Reinventing the wheel — `dnd-kit-sortable-tree` solves this exact problem |

**Usage example:**

```typescript
import { SortableTree } from 'dnd-kit-sortable-tree';

function CategoryGroupManager() {
  const [items, setItems] = useState(categoryGroups); // Nested structure

  return (
    <SortableTree
      items={items}
      onItemsChanged={setItems}
      TreeItemComponent={CategoryTreeItem}
      indentationWidth={24}
    />
  );
}

function CategoryTreeItem({ item, depth }) {
  return (
    <HStack spacing={3} pl={depth * 6}>
      <DragHandle />
      <Text>{item.name}</Text>
      <Slider
        value={item.weight}
        onChange={(val) => updateWeight(item.id, val)}
        min={0}
        max={2}
        step={0.1}
      />
      <Text fontSize="sm" color="fg.muted">
        {item.weight.toFixed(1)}x
      </Text>
    </HStack>
  );
}
```

**UI considerations:**
- Tree component for drag-and-drop hierarchy management
- Weight sliders at both group and category level
- Visual indicator of **effective weight** (group weight × category weight)
- Collapse/expand groups using Chakra UI `Collapsible` or `Accordion`
- Add/remove categories and groups with Chakra `IconButton` + `Popover`

**Sources:**
- [dnd-kit-sortable-tree library](https://github.com/Shaddix/dnd-kit-sortable-tree) — tree drag-and-drop (MEDIUM confidence, GitHub)
- [dnd-kit documentation](https://docs.dndkit.com/presets/sortable) — foundation library (HIGH confidence, official docs)
- [Top drag-and-drop libraries 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — comparison (LOW confidence, blog but verified)
- [Hierarchical UI patterns](https://ui-patterns.com/patterns/categorization) — tree navigation best practices (MEDIUM confidence, design patterns site)

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **LLM fine-tuning libraries** (Unsloth, LoRA adapters, transformers) | Overkill for single-user app, requires GPU, training infrastructure, model versioning, no immediate feedback application | Feedback-adjusted category weights in scoring formula |
| **External config management** (Consul, etcd, Spring Cloud Config) | Single-user local app, no distributed systems, unnecessary complexity | Pydantic Settings with lru_cache + cache_clear() |
| **Complex tree libraries** (react-complex-tree, AG Grid tree, DevExtreme TreeView) | Heavy, over-engineered, commercial licensing, larger bundles | dnd-kit-sortable-tree (lightweight, open source, purpose-built) |
| **Redux/Zustand for feedback state** | Feedback is ephemeral action, no need for global state management | TanStack Query mutations with optimistic updates |
| **ollama-python full SDK** | Already have it (v0.6.1 in dependencies), but noting: avoid over-using wrapper methods when direct REST calls are simpler | Use existing ollama library methods: .list(), .show() |
| **Separate PostgreSQL or complex RDBMS** | SQLite JSON columns sufficient for nested category structures, no need for heavyweight database | SQLite json_tree() + Python logic |

---

## Installation Summary

### Backend
**No new dependencies required.** All capabilities available in existing stack:
- `ollama` (v0.6.1) — already in `pyproject.toml`
- `httpx` (v0.28.1) — already in `pyproject.toml`
- `sqlmodel` (v0.0.32) — already in `pyproject.toml`

### Frontend
**One new dependency:**

```bash
cd frontend
bun add dnd-kit-sortable-tree
```

All other capabilities use existing libraries:
- TanStack Query — already in `package.json`
- Chakra UI v3 — already in `package.json`
- react-icons — already in `package.json`
- @dnd-kit/core, @dnd-kit/sortable — already in `package.json`

---

## Database Migrations Required

### 1. New ArticleFeedback table

```sql
CREATE TABLE IF NOT EXISTS article_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    feedback_type TEXT NOT NULL CHECK(feedback_type IN ('thumbs_up', 'thumbs_down', 'score_adjustment')),
    previous_score REAL,
    adjusted_score REAL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_article_feedback_article_id ON article_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_article_feedback_type ON article_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_article_feedback_created_at ON article_feedback(created_at);
```

### 2. Extend UserPreferences table

```sql
-- Add columns for category groups and overrides (if not already present)
ALTER TABLE user_preferences ADD COLUMN category_groups TEXT DEFAULT '[]';
ALTER TABLE user_preferences ADD COLUMN category_overrides TEXT DEFAULT '{}';
```

**Note:** SQLAlchemy's `create_all()` does NOT handle `ALTER TABLE ADD COLUMN` on existing tables. Migrations must be handled in `database.py` startup checks (existing pattern in codebase).

---

## Configuration Changes

### Backend config.py

**No structural changes needed.** Existing `OllamaConfig` model supports runtime updates via cache clearing:

```python
# In backend/src/backend/config.py
class OllamaConfig(BaseModel):
    """Ollama LLM configuration."""

    host: str = "http://localhost:11434"
    categorization_model: str = "qwen3:8b"
    scoring_model: str = "qwen3:8b"
    timeout: float = 120.0
```

Runtime updates handled via:
```python
# Clear @lru_cache to reload settings
get_settings.cache_clear()
```

**Alternative approach:** Store Ollama model selections in `UserPreferences` table instead of config file. This allows per-user model choices without touching config files or environment variables.

```python
# Extend UserPreferences model
class UserPreferences(SQLModel, table=True):
    # ... existing fields
    ollama_categorization_model: str | None = Field(default=None)
    ollama_scoring_model: str | None = Field(default=None)

    def get_categorization_model(self, settings: Settings) -> str:
        """Get categorization model, preferring user override."""
        return self.ollama_categorization_model or settings.ollama.categorization_model
```

This approach is **recommended** over config file updates for single-user app UX.

---

## Integration Points

### Backend API Endpoints

**New endpoints to add:**

```python
# Ollama configuration
GET /api/ollama/models          # List available models
GET /api/ollama/health          # Check connection status
GET /api/ollama/model/{name}    # Get model details
PUT /api/preferences/ollama     # Update model selections

# Feedback
POST /api/articles/{id}/feedback   # Submit feedback (thumbs up/down)
GET /api/articles/{id}/feedback    # Get feedback history for article
GET /api/feedback/stats            # Aggregate feedback stats by category

# Category groups
GET /api/preferences/category-groups      # Get category hierarchy
PUT /api/preferences/category-groups      # Update category hierarchy
POST /api/preferences/category-groups     # Create new group
DELETE /api/preferences/category-groups/{id}  # Delete group
```

### Frontend Components

**New components to create:**

```
src/components/settings/
  ├── OllamaSettings.tsx        # Model selection, health indicator
  └── CategoryGroupManager.tsx  # Tree with drag-and-drop

src/components/article/
  └── FeedbackButtons.tsx       # Thumbs up/down + score slider

src/hooks/
  ├── useOllamaModels.ts        # Fetch available models
  ├── useOllamaHealth.ts        # Connection health check
  ├── useArticleFeedback.ts     # Submit feedback mutation
  └── useCategoryGroups.ts      # CRUD for category hierarchy
```

### Data Flow

1. **Ollama config:** User selects models in settings → PUT `/api/preferences/ollama` → updates `UserPreferences` → scoring pipeline reads updated models on next run

2. **Feedback loop:** User clicks thumbs up → POST `/api/articles/{id}/feedback` → inserts feedback record → aggregates feedback by category → updates `UserPreferences.topic_weights` → next article scoring uses adjusted weights

3. **Category grouping:** User drags category into group → PUT `/api/preferences/category-groups` → updates JSON structure → scoring pipeline resolves hierarchical weights when calculating composite scores

---

## Version Compatibility

| Package | Current Version | Minimum Required | Notes |
|---------|----------------|------------------|-------|
| ollama (Python) | 0.6.1 | 0.5.0 | API stable since v0.5, .list() and .show() available |
| httpx | 0.28.1 | 0.23.0 | Async HTTP client, FastAPI ecosystem standard |
| dnd-kit-sortable-tree | Latest (check npm) | Compatible with dnd-kit 6.x+ | Built on @dnd-kit/core@6.3.1, @dnd-kit/sortable@10.0.0 (current) |
| SQLite | 3.x | 3.38+ (2022) | json_tree() available since 3.38.0, JSONB support in 3.45.0+ (optional) |

**No version conflicts expected.** All new dependencies integrate cleanly with existing stack.

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **Ollama API integration** | HIGH | ollama Python package methods verified in official GitHub repo, REST API documented |
| **Configuration reload** | MEDIUM | lru_cache clear pattern documented in FastAPI official docs, but manual testing recommended |
| **Feedback storage** | HIGH | Standard SQLite table design, established voting/feedback patterns |
| **Feedback weight adjustment** | MEDIUM | No official sources for this specific approach, but logic is sound and widely used in recommender systems |
| **Category grouping storage** | HIGH | SQLite JSON columns well-documented, json_tree() is stable API |
| **dnd-kit-sortable-tree** | MEDIUM | Library confirmed in npm registry, active GitHub repo, but not exhaustively tested in production |
| **UI components** | HIGH | All Chakra UI v3 components exist and are documented |

---

## Open Questions

1. **Ollama model metadata:** Does `ollama.show(model)` return sufficient detail for UI display (size, parameters, family, quantization)? May need to test response format against actual Ollama installation.

2. **Feedback aggregation timing:** Should category weight adjustments apply immediately after each feedback submission, or batch overnight? Immediate feels more responsive but could cause score churn. Recommend: immediate update, but recalculate composite scores in background job.

3. **Category group depth limit:** Should UI enforce max 2 levels (groups → categories) or allow deeper nesting? Deeper = more complex UI and weight resolution. Recommend: limit to 2 levels for v1.1, extend later if needed.

4. **Feedback decay:** Should old feedback signals lose influence over time? E.g., thumbs up from 6 months ago counts less than thumbs up from yesterday. Recommend: defer to future iteration, keep simple initially.

5. **Category auto-assignment to groups:** When LLM assigns a new category not seen before, should it auto-assign to a group based on semantic similarity? Or always default to "Ungrouped"? Recommend: default to ungrouped, user manually organizes.

---

## Sources Summary

**HIGH confidence sources (official documentation):**
- [FastAPI Settings](https://fastapi.tiangolo.com/advanced/settings/)
- [SQLite JSON functions](https://sqlite.org/json1.html)
- [dnd-kit sortable preset](https://docs.dndkit.com/presets/sortable)

**MEDIUM confidence sources (official repos, tutorials):**
- [Ollama Python library GitHub](https://github.com/ollama/ollama-python)
- [Ollama API docs](https://docs.ollama.com/api/tags)
- [dnd-kit-sortable-tree GitHub](https://github.com/Shaddix/dnd-kit-sortable-tree)
- [SQLite JSON querying tutorial](https://dadroit.com/blog/json-querying/)
- [RLHF Wikipedia](https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback)

**LOW confidence sources (blogs, community discussions):**
- [Ollama health check issue](https://github.com/ollama/ollama/issues/1378)
- [Thumbs up/down patterns blog](https://www.zonkafeedback.com/blog/collecting-feedback-with-thumbs-up-thumbs-down-survey)
- [Top drag-and-drop libraries 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)

---

*Stack research for: RSS Reader v1.1 — Configuration, Feedback & Category Grouping*
*Researched: 2026-02-14*
*Confidence: MEDIUM-HIGH*
