# Stack Research: v1.1 Feature Additions

**Domain:** RSS Reader — Ollama Config UI, Real-Time Push (SSE), LLM Feedback Loop, Feed Categories, Feed Auto-Discovery, UI Polish
**Researched:** 2026-02-14
**Confidence:** HIGH

## New Stack Additions

### Backend Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| sse-starlette | 3.2.0 (Jan 2026) | Server-Sent Events for FastAPI | Production-ready SSE implementation following W3C spec, native FastAPI/Starlette integration, automatic client disconnect detection, built on modern Python async patterns. Standard choice for SSE in FastAPI. |
| feedsearch-crawler | 1.0.3+ | RSS feed discovery from blog URLs | Async Web crawler built on asyncio/aiohttp for rapid feed URL scanning, searches link tags, default CMS feed locations, and internal linked pages. Successor to deprecated feedsearch library. |
| httpx | latest | HTTP client for Ollama API queries | Already likely in use via dependencies, but explicitly needed for `GET /api/tags` and `POST /api/show` to query Ollama for available models and connection status. Async-first, modern replacement for requests. |

### Frontend Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (Native EventSource) | browser API | SSE client for real-time push | Browser-native EventSource API handles SSE connections with automatic reconnection. No library needed — use directly in custom React hook with useEffect for lifecycle management. |

## NO New Frontend Libraries Needed

**React SSE:** Browser's native `EventSource` API is sufficient. Modern React SSE patterns use custom hooks wrapping EventSource in useEffect for connection lifecycle, error handling, and automatic reconnection. Libraries like `react-eventsource` or `react-hooks-sse` add minimal value over a well-structured custom hook.

**Why NOT use a library:**
- EventSource is stable browser API (not experimental)
- Automatic reconnection is built-in
- Custom hook provides full control over connection state, error handling, and cleanup
- Avoids dependency maintenance burden for simple API wrapper

## Integration Points with Existing Stack

### 1. Ollama Configuration UI

**Backend changes:**
- Add `GET /api/ollama/models` endpoint using httpx to call `http://localhost:11434/api/tags`
- Add `GET /api/ollama/status` endpoint to check Ollama connection health
- Add `PUT /api/ollama/config` endpoint to persist model overrides in database
- Extend `OllamaConfig` Pydantic model in `config.py` to support database overrides
- Add new `OllamaSettings` table in `models.py` for per-user model preferences (or extend `UserPreferences`)

**Frontend changes:**
- New settings page/drawer using existing Chakra UI v3 components
- TanStack Query for fetching models and status (standard pattern)
- Form state management via React useState (no form library needed)

**Why httpx:** Already in FastAPI ecosystem, async-first, clean API for external HTTP calls. No need for `ollama-python` library — REST API is simple and direct.

### 2. Real-Time Push (SSE)

**Backend changes:**
- Install `sse-starlette` via `uv add sse-starlette`
- Create `GET /api/events` endpoint returning `EventSourceResponse`
- Async generator yields events for: feed refresh complete, article scored, scoring state change
- EventSourceResponse yields dicts with `{"event": "article_scored", "data": json.dumps({...}), "id": str(timestamp)}`
- Integrate with existing APScheduler background jobs in `main.py` to emit events

**Frontend changes:**
- Custom `useSSE` hook wrapping EventSource API
- Hook manages: connection state, reconnection, message parsing, error handling, cleanup on unmount
- Replace adaptive polling logic in `useArticles` with SSE subscription
- Keep TanStack Query for initial data fetch and mutations, use SSE to invalidate queries on server events
- Pattern: SSE event → `queryClient.invalidateQueries(['articles'])` → refetch

**Why NOT replace TanStack Query:** SSE handles push, TanStack Query handles data fetching, caching, and optimistic updates. They complement each other. SSE eliminates polling, but Query manages client-side data layer.

### 3. LLM Feedback Loop

**Backend changes:**
- Add `feedback_score` (nullable int) to Article model in `models.py`
- Add `POST /api/articles/{id}/feedback` endpoint accepting `{"type": "positive" | "negative" | "more_like_this" | "less_like_this"}`
- Store feedback as adjustment factor to composite_score (e.g., +2 for positive, -2 for negative)
- Extend `UserPreferences` model with `feedback_history` JSON column: `{"category:technology": {"positive": 5, "negative": 2}}`
- Modify scoring prompt in `prompts.py` to include feedback-adjusted topic weights

**Frontend changes:**
- Add thumbs up/down buttons to ArticleRow (Chakra IconButton)
- Add "More/Less like this" actions in ArticleReader drawer
- TanStack Query mutation for feedback submission with optimistic updates

**Why NOT full RLHF:** RLHF requires reward model training, policy optimization, and significant compute. For single-user RSS reader, simple feedback scoring adjustments (weighted categories, boosted/penalized scores) provide 80% of value with 5% of complexity. Pattern: implicit feedback (clicks, read time) + explicit feedback (thumbs up/down) → adjust category weights → influence future scoring.

**Pattern:** Collect feedback → aggregate by category → adjust topic_weights in UserPreferences → scoring prompt includes "User values 'technology' highly (8 positive, 1 negative feedback)" → LLM adjusts interest scores accordingly.

### 4. Feed Categories/Folders

**Backend changes:**
- Add `category` (nullable string) to Feed model in `models.py`
- Add `GET /api/feeds?category={name}` filter support
- Add `PUT /api/feeds/{id}/category` endpoint to assign/change category
- Add `GET /api/categories` endpoint returning distinct category list with feed counts

**Frontend changes:**
- Extend Sidebar with collapsible category sections (Chakra Collapsible component)
- Add category dropdown/input to feed add/edit forms
- Filter articles by feed category when category is selected in sidebar

**Why simple string field:** Folders/categories are flat (not nested hierarchies) for single-user app. String field with NULL = "Uncategorized" is simplest. If nested categories become needed later, use `category_path` string with "/" delimiter (e.g., "Tech/AI").

### 5. Feed Auto-Discovery

**Backend changes:**
- Install `feedsearch-crawler` via `uv add feedsearch-crawler`
- Add `POST /api/feeds/discover` endpoint accepting `{"url": "https://blog.example.com"}`
- Endpoint uses feedsearch-crawler to scan URL for RSS/Atom feeds
- Returns list of discovered feeds with metadata (title, feed URL, feed type)
- Frontend presents options, user selects which to add

**Frontend changes:**
- Add "Discover feeds" input field in feed management UI
- TanStack Query mutation for discovery endpoint
- Display discovered feeds in selectable list (Chakra Checkbox + Card)
- Batch add selected feeds via existing `POST /api/feeds` endpoint

**Why feedsearch-crawler:** Async/aiohttp-based for fast scanning, actively maintained (successor to deprecated feedsearch), handles common patterns (link tags with `rel="alternate"`, `/feed`, `/rss`, `/atom.xml` paths, internal page scanning).

### 6. UI & Theme Polish

**NO new libraries needed.**

Chakra UI v3 provides complete design system. Polish = refinement using existing semantic tokens, spacing system, and component variants.

**Focus areas:**
- Adjust spacing/padding values in existing components
- Refine color semantic tokens in `frontend/src/theme/colors.ts`
- Add loading skeletons (Chakra Skeleton component)
- Polish animations (Chakra animation utilities + Emotion keyframes)
- Improve responsive breakpoints (Chakra responsive props)

## Installation Commands

### Backend

```bash
cd backend
uv add sse-starlette
uv add feedsearch-crawler
uv add httpx  # If not already present
```

### Frontend

**No new dependencies.** Use browser-native EventSource API.

## Alternatives Considered

| Recommended | Alternative | Why NOT Alternative |
|-------------|-------------|---------------------|
| sse-starlette | fastapi-sse-stream | sse-starlette is more actively maintained, better documented, follows W3C spec exactly. fastapi-sse-stream is less widely adopted. |
| Native EventSource | react-eventsource, react-hooks-sse | EventSource is stable browser API with automatic reconnection. Libraries add minimal value for simple wrapper hook. Reduces dependencies. |
| feedsearch-crawler | feedsearch, rss-finder | feedsearch is deprecated (no longer maintained). rss-finder is less feature-complete. feedsearch-crawler is async, actively maintained, comprehensive. |
| Simple feedback scoring | Full RLHF with reward model training | RLHF requires training infrastructure, compute, and complexity inappropriate for single-user local app. Simple category weighting provides 80% of value with 5% of effort. |
| SQLite JSON column for feedback | Separate UserFeedback table | JSON column in UserPreferences sufficient for aggregated category-level feedback. Separate table over-engineers for single-user app without complex queries. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| WebSockets for real-time push | SSE is unidirectional (server→client), simpler protocol, automatic reconnection, works over HTTP/2, lower overhead. WebSockets needed only for bidirectional real-time (chat, collaborative editing). | Server-Sent Events (SSE) via sse-starlette + EventSource |
| Socket.IO | Over-engineered for server→client push, adds fallback complexity (long polling, etc.), larger bundle size, unnecessary abstraction. | SSE for server push, standard HTTP for client→server |
| ollama-python library | Adds dependency for simple REST API calls. httpx or requests sufficient for `/api/tags` and `/api/show` endpoints. Direct control over requests/errors. | httpx (already in FastAPI ecosystem) |
| Redux, Zustand, Jotai for feedback state | TanStack Query mutation + optimistic updates handle feedback submission cleanly. No need for global state management library for simple feedback actions. | TanStack Query mutations |
| react-query SSE plugins | Custom hook with EventSource + query invalidation is simpler, more explicit, easier to debug than plugin abstraction. | Custom useSSE hook + queryClient.invalidateQueries() |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| sse-starlette 3.2.0 | FastAPI 0.100+, Starlette 0.27+ | Released Jan 2026, production-ready. Requires Python 3.9+. |
| feedsearch-crawler 1.0.3 | Python 3.7+, aiohttp 3.0+ | Async-first, works with existing asyncio patterns in FastAPI. |
| Native EventSource | All modern browsers (Chrome 6+, Firefox 6+, Safari 5+) | IE not supported (irrelevant in 2026). Polyfills exist but unnecessary. |

## Implementation Patterns

### SSE Pattern (Backend + Frontend)

**Backend (FastAPI):**
```python
from sse_starlette import EventSourceResponse
from fastapi import APIRouter

router = APIRouter()

async def event_generator():
    """Yield SSE events."""
    while True:
        # Wait for events from background jobs or asyncio Queue
        event_data = await wait_for_event()
        yield {
            "event": "article_scored",
            "data": json.dumps({"article_id": 123, "score": 8.5}),
            "id": str(int(time.time()))
        }

@router.get("/api/events")
async def sse_endpoint():
    return EventSourceResponse(event_generator())
```

**Frontend (React):**
```typescript
function useSSE(url: string) {
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource(url);

    eventSource.onopen = () => setConnected(true);

    eventSource.addEventListener('article_scored', (e) => {
      const data = JSON.parse(e.data);
      queryClient.invalidateQueries(['articles']);
    });

    eventSource.onerror = () => {
      setConnected(false);
      // EventSource automatically reconnects
    };

    return () => eventSource.close();
  }, [url, queryClient]);

  return { connected };
}
```

### Feedback Scoring Pattern

**Storage (extend UserPreferences):**
```python
class UserPreferences(SQLModel, table=True):
    # ... existing fields
    feedback_history: dict[str, dict[str, int]] | None = Field(
        default=None,
        sa_column=Column(JSON)
    )
    # Example: {"technology": {"positive": 10, "negative": 2}, "politics": {"positive": 1, "negative": 5}}
```

**Scoring adjustment:**
```python
def get_adjusted_weights(preferences: UserPreferences) -> dict[str, float]:
    """Calculate category weights from feedback history."""
    weights = {}
    for category, feedback in (preferences.feedback_history or {}).items():
        positive = feedback.get("positive", 0)
        negative = feedback.get("negative", 0)
        net_score = positive - negative
        # Map net_score to weight: -10 to +10 → 0.0 to 2.0
        weights[category] = max(0.0, 1.0 + (net_score / 10.0))
    return weights
```

**Prompt injection:**
```python
prompt = f"""
User feedback indicates preferences:
{format_feedback_weights(adjusted_weights)}

Score this article considering user's demonstrated preferences.
"""
```

### Feed Discovery Pattern

**Backend endpoint:**
```python
from feedsearch_crawler import search

@router.post("/api/feeds/discover")
async def discover_feeds(url: str):
    """Discover RSS/Atom feeds from a blog URL."""
    results = await search(url, max_depth=1)
    return [
        {
            "title": feed.title or feed.url,
            "url": feed.url,
            "type": feed.content_type,
            "score": feed.score  # feedsearch confidence score
        }
        for feed in results
    ]
```

## Sources

### SSE Implementation
- [Implementing Server-Sent Events (SSE) with FastAPI](https://mahdijafaridev.medium.com/implementing-server-sent-events-sse-with-fastapi-real-time-updates-made-simple-6492f8bfc154)
- [sse-starlette PyPI](https://pypi.org/project/sse-starlette/)
- [How to use Server-Sent Events with FastAPI and React](https://www.softgrade.org/sse-with-fastapi-react-langgraph/)
- [How to Implement Server-Sent Events (SSE) in React](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view)

### Ollama API
- [List models - Ollama](https://docs.ollama.com/api/tags)
- [API Reference - Ollama](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Introduction - Ollama](https://docs.ollama.com/api/introduction)

### Feed Discovery
- [RSS Autodiscovery](https://www.rssboard.org/rss-autodiscovery/)
- [feedsearch PyPI](https://pypi.org/project/feedsearch/)
- [feedsearch-crawler PyPI](https://pypi.org/project/feedsearch-crawler/)
- [GitHub - DBeath/feedsearch-crawler](https://github.com/DBeath/feedsearch-crawler)

### Feedback Loop Patterns
- [Adapting the Facebook Reels RecSys AI Model Based on User Feedback](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/)
- [User preference and embedding learning with implicit feedback for recommender systems](https://link.springer.com/article/10.1007/s10618-020-00730-8)
- [LLM Training: RLHF and Its Alternatives](https://magazine.sebastianraschka.com/p/llm-training-rlhf-and-its-alternatives)
- [RLHF vs RLAIF: Choosing the right approach for fine-tuning your LLM](https://labelbox.com/blog/rlhf-vs-rlaif/)

---
*Stack research for: RSS Reader v1.1 features*
*Researched: 2026-02-14*
