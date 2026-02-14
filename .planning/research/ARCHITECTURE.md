# Architecture Research: v1.1 Feature Integration

**Domain:** RSS Reader - v1.1 Feature Integration with Existing Architecture
**Researched:** 2026-02-14
**Confidence:** HIGH

## Executive Summary

This research analyzes how v1.1 features (Ollama Config UI, SSE Push, LLM Feedback Loop, Feed Categories, Feed Auto-Discovery, UI Polish) integrate with the existing RSS reader architecture. Focus is on integration points, data flow changes, and build dependencies between features.

**Key Architectural Changes:**
1. **Runtime configuration** - Split config into static (Pydantic @lru_cache) and dynamic (database-backed UserPreferences)
2. **Real-time push** - SSE endpoint broadcasts scoring progress to frontend, frontend invalidates TanStack Query cache
3. **Feedback loop** - User interactions (read, skip, manual score adjustment) stored in Article model, influence future scoring via prompt injection
4. **Feed organization** - New FeedCategory model with many-to-many relationship to Feed
5. **Feed discovery** - HTML parser service integrated with feed creation flow

## Integration Analysis by Feature

### 1. Ollama Config UI

**Current State:**
- Config in `backend/config.py` using Pydantic Settings with `@lru_cache`
- Priority: env vars > .env file > YAML config > defaults
- Immutable at runtime (requires restart to change)
- Ollama models specified: `categorization_model` and `scoring_model`

**Integration Strategy:**
- **Split config into static (system) vs dynamic (user preferences)**
  - Static: `ollama.host`, `ollama.timeout`, `database.path` → remain in Pydantic Settings
  - Dynamic: model selection, prompt templates → move to UserPreferences model
- **UserPreferences schema additions:**
  ```python
  class UserPreferences(SQLModel, table=True):
      # ... existing fields ...
      categorization_model: str | None = Field(default=None)  # If None, use config default
      scoring_model: str | None = Field(default=None)
      custom_categorization_prompt: str | None = Field(default=None)  # Override template
      custom_scoring_prompt: str | None = Field(default=None)
  ```
- **Scoring pipeline changes:**
  - `scoring.py`: Load model names from preferences first, fallback to config
  - `prompts.py`: Add `build_custom_prompt()` function that merges user template overrides
- **API endpoints (new):**
  - `GET /api/ollama/models` - List available models from Ollama API
  - `PATCH /api/preferences/ollama` - Update model selection
  - `GET /api/prompts/{type}` - Get current prompt template (categorization/scoring)
  - `PUT /api/prompts/{type}` - Update prompt template
- **Frontend components (new):**
  - `SettingsModal.tsx` with tabs: Preferences, Ollama Config, Prompts
  - `OllamaConfigPanel.tsx` - Model selection dropdowns
  - `PromptEditor.tsx` - Textarea with preview, reset to default button

**Data Flow:**
```
User selects model in UI
    ↓
PATCH /api/preferences/ollama
    ↓
Update UserPreferences.categorization_model
    ↓
Next article scoring reads preferences
    ↓
scoring.py uses new model
```

**Build Order:** Early (enables experimentation with different models during development)

**Confidence:** HIGH - Standard database-backed config override pattern

---

### 2. SSE Push (Real-Time Updates)

**Current State:**
- Frontend polls with TanStack Query (`refetchInterval: 10000ms` when scoring active)
- APScheduler runs `process_scoring_queue()` every 30s (batch size 5)
- No server-to-client push mechanism

**Integration Strategy:**
- **Backend: SSE endpoint + event broadcaster**
  - Install `sse-starlette` package
  - Create `EventBroadcaster` class in new `backend/events.py`:
    ```python
    class EventBroadcaster:
        def __init__(self):
            self.channels: dict[str, list[asyncio.Queue]] = {}

        async def subscribe(self, channel: str) -> AsyncGenerator[dict, None]:
            queue = asyncio.Queue()
            if channel not in self.channels:
                self.channels[channel] = []
            self.channels[channel].append(queue)
            try:
                while True:
                    yield await queue.get()
            finally:
                self.channels[channel].remove(queue)

        async def broadcast(self, channel: str, event: dict):
            if channel in self.channels:
                for queue in self.channels[channel]:
                    await queue.put(event)
    ```
  - New endpoint `GET /api/events/scoring` (SSE):
    ```python
    @app.get("/api/events/scoring")
    async def scoring_events(request: Request):
        async def event_generator():
            async for event in broadcaster.subscribe("scoring"):
                if await request.is_disconnected():
                    break
                yield event
        return EventSourceResponse(event_generator())
    ```
  - Modify `scoring_queue.py` to broadcast events:
    ```python
    await broadcaster.broadcast("scoring", {
        "event": "article_scored",
        "data": {
            "article_id": article.id,
            "composite_score": article.composite_score,
            "scoring_state": "scored"
        }
    })
    ```
- **Frontend: EventSource + TanStack Query invalidation**
  - New hook `useScoringEvents.ts`:
    ```typescript
    export function useScoringEvents() {
      const queryClient = useQueryClient();

      useEffect(() => {
        const eventSource = new EventSource(`${API_BASE_URL}/api/events/scoring`);

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.event === "article_scored") {
            // Invalidate articles query to refetch
            queryClient.invalidateQueries({ queryKey: ["articles"] });
            // Optionally: direct cache update for smoother UX
            queryClient.setQueryData(["articles"], (old) => {
              // Update article in cache
            });
          }
        };

        return () => eventSource.close();
      }, [queryClient]);
    }
    ```
  - Call `useScoringEvents()` in `AppShell.tsx` (top-level component)

**Data Flow:**
```
APScheduler processes article
    ↓
scoring_queue.py completes scoring
    ↓
broadcaster.broadcast("scoring", {...})
    ↓
All connected SSE clients receive event
    ↓
Frontend invalidates TanStack Query cache
    ↓
UI refetches and displays newly scored article
```

**Build Order:** Mid (depends on stable scoring pipeline, enables better UX for remaining features)

**Confidence:** HIGH - Well-documented FastAPI SSE pattern, TanStack Query invalidation is standard

**Sources:**
- [sse-starlette PyPI documentation](https://pypi.org/project/sse-starlette/)
- [FastAPI SSE implementation guide](https://medium.com/@Rachita_B/implementing-sse-server-side-events-using-fastapi-3b2d6768249e)
- [TanStack Query with SSE integration](https://github.com/TanStack/query/discussions/418)
- [Next.js SSE real-time updates](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/)

---

### 3. LLM Feedback Loop

**Current State:**
- Scoring uses static preferences: `interests`, `anti_interests`, `topic_weights`
- No signal from user behavior (what they actually read vs skip)
- No article-specific feedback mechanism

**Integration Strategy:**
- **Capture implicit feedback signals:**
  - Track: read duration, read/skip patterns, manual mark-as-read, explicit thumbs up/down
  - Store in Article model (extend):
    ```python
    class Article(SQLModel, table=True):
        # ... existing fields ...
        read_duration_seconds: int | None = Field(default=None)  # Actual time spent reading
        user_feedback: str | None = Field(default=None)  # "positive", "negative", None
        feedback_reason: str | None = Field(default=None)  # Optional text reason
        last_interaction_at: datetime | None = Field(default=None)
    ```
  - New API endpoint:
    ```python
    @app.post("/api/articles/{article_id}/feedback")
    def submit_feedback(article_id: int, feedback: FeedbackSubmission):
        # Update article.user_feedback, article.feedback_reason
        pass
    ```
- **Analyze feedback to adjust scoring:**
  - New service `backend/feedback_analyzer.py`:
    ```python
    async def analyze_user_behavior(session: Session) -> dict:
        # Query articles from last 30 days
        # Identify patterns:
        # 1. Categories with high read rate → boost weight
        # 2. Categories with low read rate → reduce weight
        # 3. Articles marked negative → extract anti-patterns
        # 4. Articles marked positive → extract positive patterns

        return {
            "suggested_weight_adjustments": {...},
            "emerging_interests": [...],
            "emerging_anti_interests": [...]
        }
    ```
  - Scheduled job (daily): Run analyzer, store suggestions in UserPreferences:
    ```python
    class UserPreferences(SQLModel, table=True):
        # ... existing fields ...
        feedback_insights: dict | None = Field(default=None, sa_column=Column(JSON))
        # Structure: {
        #   "category_performance": {"tech": {"read_rate": 0.8, "avg_score": 8.5}},
        #   "suggested_adjustments": {"tech": "increase", "sports": "decrease"},
        #   "last_analyzed": "2026-02-14T10:00:00Z"
        # }
    ```
- **Inject feedback into scoring prompts:**
  - Modify `prompts.py` `build_scoring_prompt()` to include feedback insights:
    ```python
    def build_scoring_prompt(
        article_title: str,
        article_text: str,
        interests: str,
        anti_interests: str,
        feedback_insights: dict | None = None,
    ) -> str:
        # ... existing prompt ...

        if feedback_insights:
            prompt += f"\n\n**User Behavior Insights:**"
            prompt += f"\nRecently read articles in categories: {feedback_insights.get('high_read_categories')}"
            prompt += f"\nRecently skipped articles in categories: {feedback_insights.get('low_read_categories')}"
            prompt += f"\nPositive feedback keywords: {feedback_insights.get('positive_patterns')}"

        return prompt
    ```
- **Frontend: Feedback UI**
  - Add thumbs up/down buttons in `ArticleReader.tsx`
  - Track read duration with `useAutoMarkAsRead` hook (already exists)
  - Send feedback on drawer close

**Data Flow:**
```
User reads article (tracked duration)
    ↓
On drawer close, send read_duration_seconds to API
    ↓
Nightly: feedback_analyzer.py runs
    ↓
Analyzes last 30 days of read/skip patterns
    ↓
Updates UserPreferences.feedback_insights
    ↓
Next scoring batch: prompts.py injects insights into LLM prompt
    ↓
LLM sees "User recently read 80% of 'programming' articles but skipped 90% of 'sports'"
    ↓
Adjusted interest_score reflects learned preferences
```

**Build Order:** Late (depends on stable article data, SSE for real-time feedback display)

**Confidence:** MEDIUM - Feedback analysis logic is custom (no standard library), prompt injection is straightforward but effectiveness depends on LLM's ability to incorporate insights

**Sources:**
- [RLHF overview from AWS](https://aws.amazon.com/what-is/reinforcement-learning-from-human-feedback/)
- [Personalized RLHF research (PLUS framework)](https://openreview.net/forum?id=Ar078WR3um)
- [Learning from user behavior for LLMs](https://rlhfbook.com/book.pdf)

---

### 4. Feed Categories

**Current State:**
- Feeds have `display_order` for manual sorting
- No grouping or categorization of feeds
- Sidebar shows flat list of feeds

**Integration Strategy:**
- **New model: FeedCategory**
  ```python
  class FeedCategory(SQLModel, table=True):
      __tablename__ = "feed_categories"

      id: int | None = Field(default=None, primary_key=True)
      name: str = Field(unique=True)
      display_order: int = Field(default=0)
      collapsed: bool = Field(default=False)  # UI state: is category collapsed?
  ```
- **Many-to-many relationship:**
  ```python
  class FeedCategoryLink(SQLModel, table=True):
      __tablename__ = "feed_category_links"

      feed_id: int = Field(foreign_key="feeds.id", primary_key=True)
      category_id: int = Field(foreign_key="feed_categories.id", primary_key=True)
  ```
  - Feeds can belong to multiple categories (e.g., "Tech News" + "Daily Reads")
  - Feeds can be uncategorized (no links) → show in "Uncategorized" section
- **API endpoints (new):**
  ```python
  GET /api/feed-categories  # List all categories with feed counts
  POST /api/feed-categories  # Create category
  PATCH /api/feed-categories/{id}  # Update name/order/collapsed
  DELETE /api/feed-categories/{id}  # Delete category (unlinks feeds)

  POST /api/feeds/{feed_id}/categories/{category_id}  # Add feed to category
  DELETE /api/feeds/{feed_id}/categories/{category_id}  # Remove feed from category
  ```
- **Frontend changes:**
  - Modify `Sidebar.tsx` to group feeds by category:
    ```
    [Category: Tech]
      - Hacker News (12)
      - The Verge (5)
    [Category: Daily Reads]
      - Morning Brew (3)
    [Uncategorized]
      - Random Blog (2)
    ```
  - Add category management UI in feed settings
  - Support drag-and-drop to move feeds between categories

**Data Flow:**
```
User creates category "Tech News"
    ↓
POST /api/feed-categories
    ↓
User drags "Hacker News" feed into "Tech News"
    ↓
POST /api/feeds/{id}/categories/{category_id}
    ↓
Sidebar refetches and displays grouped view
```

**Build Order:** Mid-Late (independent of other features, improves organization as feed count grows)

**Confidence:** HIGH - Standard many-to-many relationship pattern

---

### 5. Feed Auto-Discovery

**Current State:**
- User must manually enter RSS feed URL
- No assistance finding feeds from website URLs

**Integration Strategy:**
- **New service: `backend/feed_discovery.py`**
  ```python
  import httpx
  from bs4 import BeautifulSoup

  async def discover_feeds(url: str) -> list[dict]:
      """
      Discovers RSS/Atom feeds from a website URL.

      Returns list of discovered feeds:
      [
          {"url": "https://example.com/feed.xml", "title": "Example Feed", "type": "rss"},
          {"url": "https://example.com/atom.xml", "title": "Example Atom", "type": "atom"}
      ]
      """
      async with httpx.AsyncClient() as client:
          response = await client.get(url, follow_redirects=True, timeout=10)
          response.raise_for_status()

          soup = BeautifulSoup(response.content, "lxml")

          # Look for <link rel="alternate" type="application/rss+xml">
          feeds = []
          for link in soup.find_all("link", rel="alternate"):
              feed_type = link.get("type", "")
              if "rss" in feed_type or "atom" in feed_type:
                  feed_url = link.get("href")
                  feed_title = link.get("title", "Untitled Feed")
                  feeds.append({
                      "url": urljoin(url, feed_url),  # Handle relative URLs
                      "title": feed_title,
                      "type": "rss" if "rss" in feed_type else "atom"
                  })

          return feeds
  ```
- **API endpoint (new):**
  ```python
  @app.post("/api/feeds/discover")
  async def discover_feeds_endpoint(url: str):
      """
      Discover RSS feeds from a website URL.
      Returns list of discovered feeds.
      """
      try:
          feeds = await discover_feeds(url)
          return {"feeds": feeds}
      except Exception as e:
          raise HTTPException(status_code=400, detail=f"Failed to discover feeds: {str(e)}")
  ```
- **Frontend integration:**
  - Modify "Add Feed" modal:
    1. User enters website URL (e.g., `https://example.com`)
    2. Click "Discover Feeds" button
    3. API returns list of discovered feeds
    4. UI shows selection dialog with discovered feeds
    5. User picks one or more, confirms
    6. Normal feed creation flow continues
  - Fallback: If no feeds discovered, allow manual RSS URL entry

**Data Flow:**
```
User enters "https://techcrunch.com"
    ↓
POST /api/feeds/discover {"url": "https://techcrunch.com"}
    ↓
feed_discovery.py fetches HTML
    ↓
BeautifulSoup parses <link rel="alternate" type="application/rss+xml">
    ↓
Returns [{"url": "https://techcrunch.com/feed", "title": "TechCrunch RSS"}]
    ↓
UI shows discovered feed, user confirms
    ↓
POST /api/feeds {"url": "https://techcrunch.com/feed"}
    ↓
Normal feed creation flow
```

**Build Order:** Early-Mid (independent, improves onboarding UX)

**Confidence:** HIGH - Standard RSS auto-discovery pattern

**Sources:**
- [RSS Autodiscovery specification](https://www.rssboard.org/rss-autodiscovery)
- [RSS feed discovery implementation guide](https://blog.jim-nielsen.com/2021/automatically-discoverable-rss-feeds/)
- [BeautifulSoup with lxml parser](https://lxml.de/elementsoup.html)
- [HTML link rel alternate for feeds](https://www.petefreitag.com/blog/rss-autodiscovery/)

---

### 6. UI Polish

**Current State:**
- Basic functional UI with Chakra UI v3
- No loading states, error boundaries, or accessibility improvements

**Integration Strategy:**
- **Loading states:**
  - Skeleton loaders for article list (`Skeleton` from Chakra UI)
  - Spinner for feed operations
  - SSE connection status indicator ("Connecting...", "Live", "Disconnected")
- **Error handling:**
  - Error boundary component wrapping main app
  - Toast notifications for API errors (Chakra UI `Toaster` already available)
  - Retry buttons for failed operations
- **Accessibility:**
  - ARIA labels on interactive elements
  - Keyboard shortcuts for common actions (j/k for nav, r for mark read)
  - Focus management in modals/drawers
- **UX improvements:**
  - Optimistic updates (mark-as-read applies immediately, rolls back on error)
  - Batch operations (select multiple articles, mark all read)
  - Search/filter articles by title/content

**Build Order:** Last (polish after features work)

**Confidence:** HIGH - Standard UI/UX patterns

---

## Integration Points Summary

### New vs Modified Components

| Component | Status | Purpose |
|-----------|--------|---------|
| **Backend** | | |
| `models.py` → `Article` | MODIFIED | Add feedback fields: `read_duration_seconds`, `user_feedback`, `feedback_reason`, `last_interaction_at` |
| `models.py` → `UserPreferences` | MODIFIED | Add Ollama config: `categorization_model`, `scoring_model`, `custom_*_prompt`, `feedback_insights` |
| `models.py` → `FeedCategory` | NEW | Category model for feed organization |
| `models.py` → `FeedCategoryLink` | NEW | Many-to-many link table |
| `events.py` | NEW | SSE event broadcaster class |
| `feed_discovery.py` | NEW | RSS auto-discovery service (BeautifulSoup + httpx) |
| `feedback_analyzer.py` | NEW | User behavior analysis for feedback loop |
| `scoring.py` | MODIFIED | Load model names from preferences, pass feedback insights to prompts |
| `prompts.py` | MODIFIED | Inject feedback insights into scoring prompt |
| `scoring_queue.py` | MODIFIED | Broadcast SSE events on article scored |
| `main.py` | MODIFIED | Add new API endpoints (SSE, feed discovery, feedback, categories, Ollama config) |
| `scheduler.py` | MODIFIED | Add nightly feedback analysis job |
| **Frontend** | | |
| `types.ts` | MODIFIED | Add fields to Article, UserPreferences types |
| `api.ts` | MODIFIED | Add new API client functions (SSE not here, in hook) |
| `useScoringEvents.ts` | NEW | Hook for SSE connection, TanStack Query invalidation |
| `useFeedback.ts` | NEW | Hook for submitting article feedback |
| `SettingsModal.tsx` | NEW | Modal with tabs: Preferences, Ollama Config, Prompts |
| `OllamaConfigPanel.tsx` | NEW | Model selection UI |
| `PromptEditor.tsx` | NEW | Prompt template editing UI |
| `FeedDiscoveryModal.tsx` | NEW | Modal for discovering feeds from website URL |
| `FeedCategoryManager.tsx` | NEW | UI for creating/managing feed categories |
| `Sidebar.tsx` | MODIFIED | Group feeds by category |
| `ArticleReader.tsx` | MODIFIED | Add feedback buttons (thumbs up/down) |
| `AppShell.tsx` | MODIFIED | Call `useScoringEvents()` at top level |

---

## Data Flow Changes

### Scoring Pipeline (with all v1.1 features)

```
User submits website URL
    ↓
[Feed Discovery] HTML parser discovers RSS links
    ↓
User selects discovered feed, assigns to category
    ↓
POST /api/feeds (feed created)
    ↓
Feed refresh job fetches articles
    ↓
Articles enqueued for scoring (scoring_state: "queued")
    ↓
[APScheduler] process_scoring_queue() every 30s
    ↓
Load UserPreferences (includes: categorization_model, scoring_model, feedback_insights)
    ↓
[Categorization] categorize_article() with custom model
    ↓
[Scoring] score_article() with custom model + feedback insights injected in prompt
    ↓
compute_composite_score() considers topic_weights
    ↓
Update article (scoring_state: "scored")
    ↓
[SSE] broadcaster.broadcast("scoring", {article_id, composite_score})
    ↓
[Frontend] EventSource receives event → TanStack Query invalidates → UI refetches
    ↓
User opens article, reads for 45 seconds
    ↓
[Frontend] useFeedback hook tracks duration
    ↓
User clicks thumbs up
    ↓
POST /api/articles/{id}/feedback {read_duration_seconds: 45, user_feedback: "positive"}
    ↓
Update article.read_duration_seconds, article.user_feedback
    ↓
[Nightly] feedback_analyzer.py analyzes last 30 days
    ↓
Identifies patterns: "User reads 'programming' articles for avg 60s, skips 'sports' after 5s"
    ↓
Updates UserPreferences.feedback_insights
    ↓
Next scoring cycle: prompts inject these insights
    ↓
LLM adjusts scores based on learned behavior
```

---

## Build Order with Dependencies

**Phase 1: Foundation (Independent)**
1. **Feed Categories** - Data model + API + UI (no deps)
2. **Feed Auto-Discovery** - Service + API + UI (no deps)
3. **Ollama Config UI** - UserPreferences extension + API + UI (no deps)

**Phase 2: Real-Time Infrastructure**
4. **SSE Push** - Requires stable scoring pipeline from v1.0 (already exists)

**Phase 3: Advanced Features (Depends on Phase 2)**
5. **LLM Feedback Loop** - Requires Article model extensions, uses SSE for real-time feedback display
6. **UI Polish** - Enhances all features, applied last

**Reasoning:**
- Phase 1 features are independent, can be built in parallel
- SSE Push is foundational for real-time UX (feedback loop benefits from it)
- Feedback loop is most complex, benefits from SSE showing immediate effect of feedback
- UI polish applies finishing touches after features work

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (current) | Monolith is perfect. SQLite handles concurrent reads/writes with WAL mode. |
| 10-100 users | Add connection pooling for SQLite. Consider read replicas if scoring queries slow down reads. |
| 100+ users | Migrate to PostgreSQL for better concurrency. Consider Redis for SSE event broadcasting across multiple FastAPI instances. |

**First bottleneck:** SSE with multiple FastAPI workers. Current in-memory `EventBroadcaster` won't work across processes. Solution: Use Redis pub/sub for cross-process event broadcasting.

**Second bottleneck:** Scoring queue. Single-threaded APScheduler processes 5 articles/30s. Solution: Increase batch size, add more workers, or use Celery for distributed task queue.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Ollama Prompt Templates in Database

**What people do:** Store full LLM prompt templates in database, allowing user to edit from scratch.

**Why it's wrong:**
- Prompts are code, not configuration. Breaking changes to prompt structure require migrations.
- Users can break scoring by editing prompts incorrectly.
- Version control for prompts becomes difficult.

**Do this instead:**
- Store only *user-provided supplements* (e.g., "Additional interests: X") in database.
- Keep base prompt template in code (`prompts.py`).
- Provide limited, safe customization options in UI (e.g., "Add custom interests", not "Edit full prompt").

### Anti-Pattern 2: Synchronous HTML Fetching in Feed Discovery

**What people do:** Use `requests.get()` synchronously in FastAPI endpoint.

**Why it's wrong:** Blocks the entire event loop while waiting for HTTP response. FastAPI is async, blocking calls kill performance.

**Do this instead:** Use `httpx.AsyncClient()` with `await` for all HTTP calls. This is already planned in the integration strategy above.

### Anti-Pattern 3: Real-Time Query Refetching Without SSE

**What people do:** Increase TanStack Query `refetchInterval` to 1-2 seconds for "real-time feel".

**Why it's wrong:** Hammers the API with unnecessary requests, wastes bandwidth, doesn't scale.

**Do this instead:** Use SSE to push updates only when articles are actually scored. Query refetch only on SSE event. This is the planned approach.

---

## Sources

**SSE Implementation:**
- [sse-starlette PyPI](https://pypi.org/project/sse-starlette/)
- [FastAPI SSE implementation guide](https://medium.com/@Rachita_B/implementing-sse-server-side-events-using-fastapi-3b2d6768249e)
- [Building SSE MCP Server with FastAPI](https://www.ragie.ai/blog/building-a-server-sent-events-sse-mcp-server-with-fastapi)

**TanStack Query + SSE:**
- [TanStack Query SSE discussion](https://github.com/TanStack/query/discussions/418)
- [React Query with SSE integration](https://fragmentedthought.com/blog/2025/react-query-caching-with-server-side-events)
- [Next.js SSE real-time updates](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/)

**Pydantic Settings:**
- [Pydantic Settings documentation](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- [FastAPI settings management](https://fastapi.tiangolo.com/advanced/settings/)

**LLM Feedback Loop:**
- [RLHF overview (AWS)](https://aws.amazon.com/what-is/reinforcement-learning-from-human-feedback/)
- [Personalized RLHF (PLUS framework)](https://openreview.net/forum?id=Ar078WR3um)
- [RLHF textbook](https://rlhfbook.com/book.pdf)

**RSS Auto-Discovery:**
- [RSS Autodiscovery specification](https://www.rssboard.org/rss-autodiscovery)
- [RSS feed discovery guide](https://blog.jim-nielsen.com/2021/automatically-discoverable-rss-feeds/)
- [BeautifulSoup documentation](https://beautiful-soup-4.readthedocs.io/en/latest/)
- [lxml parser integration](https://lxml.de/elementsoup.html)

---

*Architecture research for: RSS Reader v1.1 Feature Integration*
*Researched: 2026-02-14*
