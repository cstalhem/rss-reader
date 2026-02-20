# Phase 4: LLM Content Curation - Research

**Researched:** 2026-02-10
**Domain:** Local LLM integration (Ollama), article scoring, background task processing
**Confidence:** HIGH

## Summary

Phase 4 implements automatic article scoring using a local Ollama LLM through a two-step pipeline: categorization (fast, all articles) followed by interest scoring (deeper, non-blocked articles). The system uses Pydantic models for structured JSON output, APScheduler for background queue processing, and stores scores/categories/reasoning in SQLite with JSON fields.

**Key architectural decisions:** Use ollama-python v0.6.1 with Pydantic v2 for structured outputs, AsyncIOScheduler (already in codebase) for queue processing, SQLModel with JSON column types for storing arrays/objects, and qwen2.5 (7b-14b) for optimal structured output performance on classification tasks.

**Primary recommendation:** Build the scoring queue as a lightweight extension of the existing APScheduler infrastructure. Use two separate Ollama prompts (categorization then scoring) with Pydantic schema enforcement for deterministic JSON responses. Store all LLM outputs (categories, scores, reasoning) in new Article model fields using SQLite's JSON support.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Interest Preferences:**
- Hybrid input: free-form prose (primary) + structured topic weights (overrides)
- Prose input split into two sections: "Interests" and "Anti-interests"
- Topic weights use a unified scale: blocked / low / neutral / medium / high
- Preference editor lives on a dedicated settings page (not sidebar)
- Include example placeholder text in preference fields to guide first-time setup
- Explicit preferences only for Phase 4 — no implicit behavior learning
- Saving preferences triggers re-scoring of recent articles (roughly last week)

**Scoring Pipeline (Two-Step LLM):**
- **Step 1 — Categorization (all articles):** Lightweight LLM prompt assigns topic tags from seeded+emergent taxonomy. Fast, runs on every new article.
- **Step 2 — Interest scoring (non-blocked articles):** Deeper LLM prompt evaluates against user's prose preferences. Returns interest score (0-10), quality signal, and 1-2 sentence reasoning.
- Blocked categories (from unified topic weights) skip Step 2 entirely — auto-score 0
- Final composite score computed in code: base interest score × topic weight multipliers × quality penalty
- Quality signal acts as a multiplier/penalty — low-quality articles sink in ranking but still appear

**Scoring Queue:**
- Articles enter a processing queue when fetched or when re-scoring is triggered
- Queue processed in chronological order (oldest first)
- Article scoring states: unscored → queued → scoring → scored
- UI shows scoring state indicators (e.g., spinner for "scoring", dash for "unscored")
- Unscored articles visible in the list, with ability to filter them in UI
- LLM returns structured response: interest score, quality score, topic tags, reasoning text
- Reasoning stored per article for transparency

**Category System:**
- Seeded + emergent: ship with pre-populated default categories, LLM can suggest new ones
- LLM prompt includes existing category list to encourage reuse and prevent duplicates
- Normalize categories (lowercase comparison) to avoid "Crypto" vs "crypto" duplication
- Target 1-6 categories per article, hard limit of 10
- Categories managed in settings page AND quick-block/boost from article tag chips in UI
- Blocked categories cause articles to skip interest scoring entirely

**Topic Tags in UI:**
- Tags displayed as small badges/chips on article rows in list view
- More prominent tag display in the reader drawer view
- Tags are display-only in this phase (click-to-filter deferred to Phase 5)

### Claude's Discretion

- Ollama model selection and prompt engineering
- Exact composite score formula and weight multipliers
- Queue implementation details (in-memory vs database-backed)
- Category normalization/deduplication strategy
- Default seed category list
- Settings page layout and form design
- Scoring state indicator visual design
- How to handle articles that fail LLM scoring (retry logic, error states)

### Deferred Ideas (OUT OF SCOPE)

- Implicit behavior learning (time spent reading, read patterns) — future enhancement
- Explicit feedback mechanism (thumbs up/down, "more/less like this") — future enhancement
- Click-to-filter by category tag — Phase 5
- Category-based article sorting — Phase 5

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ollama-python | 0.6.1 | Ollama client | Official Python client, async support, simple API |
| Pydantic | v2 | Schema validation | Already in stack (FastAPI), 5-50x faster than v1, native JSON schema |
| APScheduler | 3.11.2+ | Background scheduler | Already in codebase for feed refresh, async support |
| SQLModel | 0.0.32+ | ORM | Already in stack, SQLAlchemy integration for JSON columns |
| httpx | 0.28.1+ | HTTP client | Already in stack, async support for Ollama connection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tenacity | Latest | Retry logic | LLM timeout/connection failures |
| instructor | Optional | Pydantic+Ollama | If native ollama-python Pydantic support insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| APScheduler | Celery + Redis | Celery requires external broker, overkill for single-server deployment |
| ollama-python | Direct HTTP API | Lose type safety, error handling, async patterns |
| Pydantic v2 | Manual JSON parsing | Lose validation, schema enforcement, FastAPI integration |
| SQLite JSON | PostgreSQL JSONB | PostgreSQL adds deployment complexity for no benefit in this scale |

**Installation:**
```bash
# Backend additions
cd backend
uv add ollama tenacity
# Pydantic v2 already in stack via FastAPI
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/backend/
├── models.py               # Add Article scoring fields, UserPreferences model
├── scoring.py              # NEW: LLM scoring logic (categorize, score)
├── scoring_queue.py        # NEW: Queue manager for article scoring
├── scheduler.py            # EXTEND: Add scoring queue job
├── main.py                 # EXTEND: Add preferences endpoints
└── prompts.py              # NEW: Pydantic schemas + prompt templates

frontend/src/
├── app/settings/
│   └── page.tsx            # NEW: Settings page with preferences editor
├── components/article/
│   ├── ArticleRow.tsx      # EXTEND: Display tags, score indicator
│   └── ArticleReader.tsx   # EXTEND: Display tags, score, reasoning
└── lib/
    ├── api.ts              # EXTEND: Add preferences, scoring endpoints
    └── types.ts            # EXTEND: Add Article scoring types
```

### Pattern 1: Two-Step LLM Pipeline with Pydantic Schemas

**What:** Sequential LLM calls with distinct Pydantic models for structured outputs. Step 1 (categorization) runs on all articles, Step 2 (scoring) only on non-blocked.

**When to use:** Multi-stage processing where early stages filter/classify before expensive operations.

**Example:**
```python
# prompts.py
from pydantic import BaseModel, Field

class CategoryResponse(BaseModel):
    """Step 1: Fast categorization response."""
    categories: list[str] = Field(
        description="1-6 topic categories from provided taxonomy",
        max_length=10
    )
    suggested_new_categories: list[str] = Field(
        default=[],
        description="New categories if existing taxonomy insufficient",
        max_length=3
    )

class ScoringResponse(BaseModel):
    """Step 2: Deep interest scoring response."""
    interest_score: int = Field(ge=0, le=10, description="Interest match 0-10")
    quality_score: int = Field(ge=0, le=10, description="Content quality 0-10")
    reasoning: str = Field(description="1-2 sentence explanation")

# scoring.py
import ollama
from ollama import AsyncClient

async def categorize_article(article_text: str, existing_categories: list[str]) -> CategoryResponse:
    """Step 1: Fast categorization using lightweight model."""
    prompt = f"""Assign 1-6 topic categories to this article.

EXISTING CATEGORIES (reuse these): {', '.join(existing_categories)}

ARTICLE:
{article_text[:2000]}  # Truncate for speed

Return JSON matching this schema:
{CategoryResponse.model_json_schema()}"""

    response = await AsyncClient().chat(
        model='qwen2.5:7b',
        messages=[{'role': 'user', 'content': prompt}],
        format=CategoryResponse.model_json_schema(),
        options={'temperature': 0}  # Deterministic
    )

    return CategoryResponse.model_validate_json(response['message']['content'])

async def score_article(
    article_text: str,
    user_interests: str,
    user_anti_interests: str
) -> ScoringResponse:
    """Step 2: Deep interest scoring using stronger model."""
    prompt = f"""Score this article against user preferences.

USER INTERESTS: {user_interests}
USER ANTI-INTERESTS: {user_anti_interests}

ARTICLE:
{article_text[:3000]}

Rate interest match (0-10), quality (0-10), and explain why.

Return JSON matching this schema:
{ScoringResponse.model_json_schema()}"""

    response = await AsyncClient().chat(
        model='qwen2.5:14b',  # Larger model for nuanced scoring
        messages=[{'role': 'user', 'content': prompt}],
        format=ScoringResponse.model_json_schema(),
        options={'temperature': 0}
    )

    return ScoringResponse.model_validate_json(response['message']['content'])
```

**Source:** [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs), [Pydantic JSON Schema](https://docs.pydantic.dev/latest/concepts/json_schema/)

### Pattern 2: Queue-Based Background Processing with APScheduler

**What:** Extend existing APScheduler to process article scoring queue. Articles transition through states (unscored → queued → scoring → scored) with batch processing.

**When to use:** Background work that must survive server restarts, needs throttling, and should run independently of API requests.

**Example:**
```python
# scoring_queue.py
from datetime import datetime, timedelta
from sqlmodel import Session, select
from backend.models import Article

class ScoringQueue:
    """Manages article scoring queue state."""

    async def enqueue_articles(self, session: Session, article_ids: list[int]):
        """Add articles to scoring queue (unscored → queued)."""
        articles = session.exec(
            select(Article).where(Article.id.in_(article_ids))
        ).all()

        for article in articles:
            article.scoring_state = "queued"
            article.queued_at = datetime.now()
            session.add(article)

        session.commit()

    async def process_next_batch(self, session: Session, batch_size: int = 10):
        """Process oldest queued articles (queued → scoring → scored)."""
        queued = session.exec(
            select(Article)
            .where(Article.scoring_state == "queued")
            .order_by(Article.published_at)  # Oldest first
            .limit(batch_size)
        ).all()

        for article in queued:
            article.scoring_state = "scoring"
            session.add(article)
        session.commit()

        for article in queued:
            try:
                await self._score_article(session, article)
            except Exception as e:
                logger.error(f"Scoring failed for article {article.id}: {e}")
                article.scoring_state = "failed"
                article.score_error = str(e)
                session.add(article)
                session.commit()

# scheduler.py (EXTEND)
from backend.scoring_queue import ScoringQueue

queue = ScoringQueue()

async def process_scoring_queue():
    """Background job to process article scoring queue."""
    with next(get_session()) as session:
        await queue.process_next_batch(session, batch_size=10)

def start_scheduler():
    """Start the background scheduler."""
    # Existing feed refresh job...

    # NEW: Add scoring queue job (every 30 seconds)
    scheduler.add_job(
        process_scoring_queue,
        "interval",
        seconds=30,
        id="process_scoring",
        replace_existing=True,
    )
```

**Source:** [FastAPI Background Tasks](https://oneuptime.com/blog/post/2026-02-02-fastapi-background-tasks/view), existing `backend/scheduler.py`

### Pattern 3: SQLite JSON Columns for Arrays/Objects

**What:** Use SQLAlchemy `JSON` type with SQLModel for storing lists and nested objects. SQLite stores as TEXT but provides JSON operators.

**When to use:** Storing variable-length arrays (categories), nested objects (composite scores), or structured metadata without separate tables.

**Example:**
```python
# models.py
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

class Article(SQLModel, table=True):
    """Article from an RSS feed."""

    __tablename__ = "articles"

    id: int | None = Field(default=None, primary_key=True)
    # ... existing fields ...

    # NEW scoring fields
    categories: list[str] | None = Field(
        default=None,
        sa_column=Column(JSON),  # SQLite JSON column
        description="LLM-assigned topic categories"
    )
    interest_score: int | None = Field(
        default=None,
        description="Base interest score 0-10 from LLM"
    )
    quality_score: int | None = Field(
        default=None,
        description="Quality score 0-10 from LLM"
    )
    composite_score: float | None = Field(
        default=None,
        description="Final weighted score (interest × topic weights × quality)"
    )
    score_reasoning: str | None = Field(
        default=None,
        description="LLM explanation for score"
    )
    scoring_state: str = Field(
        default="unscored",
        description="unscored|queued|scoring|scored|failed"
    )
    scored_at: datetime | None = None

    class Config:
        arbitrary_types_allowed = True  # Required for JSON column type

class UserPreferences(SQLModel, table=True):
    """User's scoring preferences (single row)."""

    __tablename__ = "user_preferences"

    id: int | None = Field(default=None, primary_key=True)
    interests: str = Field(default="", description="Free-form interest prose")
    anti_interests: str = Field(default="", description="Free-form anti-interest prose")
    topic_weights: dict[str, str] | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="Category → weight (blocked|low|neutral|medium|high)"
    )
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        arbitrary_types_allowed = True
```

**Source:** [SQLModel Issue #42](https://github.com/fastapi/sqlmodel/issues/42), [SQLite JSON](https://www.sqlite.org/json1.html)

### Pattern 4: Chakra UI v3 Settings Form with Field Component

**What:** Use Field.Root compound component for form inputs with labels, help text, and validation. Textarea for prose preferences, custom weight selector for topics.

**When to use:** Building forms in Chakra UI v3 (replaces deprecated FormControl).

**Example:**
```tsx
// app/settings/page.tsx
"use client"

import { Field } from "@/components/ui/field"
import { Button, Container, Heading, Stack, Textarea } from "@chakra-ui/react"
import { useState } from "react"

export default function SettingsPage() {
  const [interests, setInterests] = useState("")
  const [antiInterests, setAntiInterests] = useState("")

  return (
    <Container maxW="container.md" py={8}>
      <Stack gap={6}>
        <Heading size="lg">Preferences</Heading>

        <Field.Root>
          <Field.Label>Interests</Field.Label>
          <Textarea
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="Example: I'm interested in software architecture, distributed systems, and developer productivity. I enjoy deep technical dives with code examples."
            rows={6}
            resize="vertical"
          />
          <Field.HelperText>
            Describe what you want to read about in natural language
          </Field.HelperText>
        </Field.Root>

        <Field.Root>
          <Field.Label>Anti-interests</Field.Label>
          <Textarea
            value={antiInterests}
            onChange={(e) => setAntiInterests(e.target.value)}
            placeholder="Example: I'm not interested in cryptocurrency speculation, celebrity gossip, or clickbait news."
            rows={4}
            resize="vertical"
          />
          <Field.HelperText>
            Describe what you want to avoid
          </Field.HelperText>
        </Field.Root>

        <Button colorPalette="orange" onClick={handleSave}>
          Save Preferences
        </Button>
      </Stack>
    </Container>
  )
}
```

**Source:** [Chakra UI v3 Field](https://chakra-ui.com/docs/components/field), [Chakra UI v3 Textarea](https://chakra-ui.com/docs/components/textarea), existing theme in `frontend/src/theme/`

### Anti-Patterns to Avoid

- **Running LLM calls in API request handlers:** LLM latency (1-10s) blocks response. Always use background queue.
- **Scoring all articles synchronously on preference save:** Triggers Ollama timeout, blocks scheduler. Enqueue for batch processing instead.
- **Using ARRAY column type directly in SQLModel:** Produces `NullType()` DDL error. Use `Column(JSON)` for arrays.
- **Reading localStorage in useState initializer:** Causes Next.js hydration mismatch (server renders default, client reads stored value). Use `useEffect` post-hydration sync pattern (see `frontend/src/hooks/useLocalStorage.ts`).
- **Passing functions through Server/Client boundary:** Next.js Server Components can't serialize callbacks. Keep interactive forms in Client Components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM structured output | Custom JSON parsing with regex/manual validation | Pydantic schemas + Ollama `format` parameter | Ollama enforces schema via GBNF grammars, Pydantic validates. Custom parsing breaks on edge cases, doesn't evolve with schema. |
| Retry logic for Ollama timeouts | Manual try/except loops with sleep | `tenacity` library with exponential backoff | Handles transient failures (connection drops, server restarts), configurable strategies, tested edge cases. |
| Background job persistence | In-memory queue that loses state on restart | APScheduler with database job store (optional) or state in Article model | In-memory queues lose progress on deploy/crash. Article.scoring_state persists queue position. |
| Category normalization | Multiple if/else or regex rules | Lowercase comparison + LLM prompt guidance | LLM can deduplicate if instructed ("reuse existing categories"), code handles case. Complex rules brittle. |
| Composite score calculation | Complex nested if/else for weight multipliers | Simple formula: `base_score * topic_weight * quality_penalty` | Weight mapping (blocked=0, low=0.5, neutral=1.0, medium=1.5, high=2.0) + quality as 0.5-1.0 multiplier covers all cases cleanly. |

**Key insight:** LLMs are stochastic and slow — always pair with structured output enforcement (Pydantic schemas) and async background processing (queues). Never trust raw LLM JSON, always validate. Never block API responses on LLM calls.

## Common Pitfalls

### Pitfall 1: Ollama Connection Timeouts on Large Models

**What goes wrong:** Larger models (14b+) take 10-60s for first response (model loading), causing connection timeout errors. Subsequent requests fast (model cached).

**Why it happens:** Ollama loads model into memory on first request. Default httpx timeout (5s) too short. AsyncClient needs explicit timeout.

**How to avoid:**
```python
from ollama import AsyncClient

client = AsyncClient(timeout=120.0)  # 2 min timeout for model loading
response = await client.chat(...)
```

**Warning signs:**
- `httpx.ConnectTimeout` on first scoring attempt after server restart
- Scoring works for small articles, fails for long ones
- Errors disappear after first successful request

**Source:** [Ollama Timeout Issues](https://www.restack.io/p/ollama-answer-timeout-issues-cat-ai), [Ollama Python Configuration](https://deepwiki.com/ollama/ollama-python/5.2-configuration-and-options)

### Pitfall 2: JSON Column Fields Return as Strings

**What goes wrong:** Reading `article.categories` returns string `'["tech", "ai"]'` instead of list `["tech", "ai"]`. Causes TypeScript type errors, map() failures.

**Why it happens:** SQLite stores JSON as TEXT. SQLModel doesn't automatically deserialize without `Column(JSON)` declaration AND `arbitrary_types_allowed = True` in Config.

**How to avoid:**
```python
# models.py
from sqlalchemy import JSON, Column

class Article(SQLModel, table=True):
    categories: list[str] | None = Field(
        default=None,
        sa_column=Column(JSON)  # CRITICAL: Forces SQLAlchemy JSON handling
    )

    class Config:
        arbitrary_types_allowed = True  # CRITICAL: Allows JSON column type
```

**Warning signs:**
- Type errors in IDE: `str` where `list[str]` expected
- `json.loads()` calls in API handlers to deserialize fields
- Empty arrays stored as `'[]'` instead of `[]`

**Source:** [SQLModel Issue #42](https://github.com/fastapi/sqlmodel/issues/42), [SQLite JSON](https://www.sqlite.org/json1.html)

### Pitfall 3: Two-Step Pipeline Runs Step 2 on Blocked Articles

**What goes wrong:** Articles with blocked categories still get interest-scored, wasting LLM tokens/time and producing incorrect composite scores.

**Why it happens:** Forgetting to check `topic_weights` for blocked status before calling `score_article()`.

**How to avoid:**
```python
async def process_article(session: Session, article: Article, prefs: UserPreferences):
    # Step 1: Always categorize
    cat_response = await categorize_article(article.content, existing_categories)
    article.categories = cat_response.categories

    # Check if ANY category is blocked
    blocked_categories = [
        cat for cat in article.categories
        if prefs.topic_weights.get(cat.lower()) == "blocked"
    ]

    if blocked_categories:
        # Skip Step 2 entirely
        article.interest_score = 0
        article.quality_score = 0
        article.composite_score = 0.0
        article.score_reasoning = f"Blocked categories: {', '.join(blocked_categories)}"
    else:
        # Step 2: Interest scoring
        score_response = await score_article(
            article.content,
            prefs.interests,
            prefs.anti_interests
        )
        article.interest_score = score_response.interest_score
        article.quality_score = score_response.quality_score
        article.composite_score = compute_composite_score(
            score_response.interest_score,
            score_response.quality_score,
            article.categories,
            prefs.topic_weights
        )
        article.score_reasoning = score_response.reasoning
```

**Warning signs:**
- Blocked articles appearing in "high interest" results
- LLM cost/time higher than expected
- Composite scores don't match blocked=0 rule

### Pitfall 4: Next.js Hydration Mismatch on Preference Form

**What goes wrong:** "Hydration mismatch" error when settings page loads. Form state initializes from localStorage but server renders default values.

**Why it happens:** Server-side render produces HTML with default state, client reads localStorage and produces different HTML, React detects mismatch.

**How to avoid:**
```tsx
"use client"

import { useState, useEffect } from "react"

export default function SettingsPage() {
  // Initialize with default (matches server render)
  const [interests, setInterests] = useState("")
  const [mounted, setMounted] = useState(false)

  // Sync from localStorage AFTER hydration
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("preferences")
    if (saved) {
      const { interests } = JSON.parse(saved)
      setInterests(interests)
    }
  }, [])

  // Show loading state until hydrated
  if (!mounted) return null

  return <Textarea value={interests} onChange={...} />
}
```

**Warning signs:**
- Console error: "Text content does not match server-rendered HTML"
- Form shows default values briefly before updating to saved values
- Hydration error only on refresh, not navigation

**Source:** Project MEMORY.md (Next.js hydration gotchas), [useLocalStorage pattern](https://github.com/cstalhem/rss-reader/blob/main/frontend/src/hooks/useLocalStorage.ts)

### Pitfall 5: Stale Categories in Prompt After User Deletes Topic

**What goes wrong:** LLM continues suggesting deleted categories because `existing_categories` list passed to prompt includes deleted topics.

**Why it happens:** Category list fetched from `UserPreferences.topic_weights` keys, which persist even when weight is "blocked" or removed from UI.

**How to avoid:**
```python
async def get_active_categories(session: Session) -> list[str]:
    """Get categories actively used in recent articles (last 30 days)."""
    # Option 1: From articles (emergent)
    recent_articles = session.exec(
        select(Article)
        .where(Article.scored_at > datetime.now() - timedelta(days=30))
        .where(Article.categories.isnot(None))
    ).all()

    categories = set()
    for article in recent_articles:
        categories.update(article.categories or [])

    # Option 2: From preferences (curated) - filter out blocked
    prefs = session.exec(select(UserPreferences)).first()
    if prefs and prefs.topic_weights:
        active = {
            cat for cat, weight in prefs.topic_weights.items()
            if weight != "blocked"
        }
        categories.update(active)

    return sorted(categories)

# In categorize_article prompt:
active_categories = await get_active_categories(session)
prompt = f"EXISTING CATEGORIES (reuse these): {', '.join(active_categories)}"
```

**Warning signs:**
- LLM suggests categories you thought were deleted
- Category count grows unbounded over time
- Duplicate categories with slight variations (Tech, tech, technology)

## Code Examples

Verified patterns from official sources:

### Ollama Structured Output with Pydantic
```python
# Source: https://docs.ollama.com/capabilities/structured-outputs
from pydantic import BaseModel, Field
from ollama import AsyncClient

class CategoryResponse(BaseModel):
    categories: list[str] = Field(max_length=10)

async def categorize(text: str) -> CategoryResponse:
    response = await AsyncClient(timeout=120.0).chat(
        model='qwen2.5:7b',
        messages=[{'role': 'user', 'content': f'Categorize: {text}'}],
        format=CategoryResponse.model_json_schema(),
        options={'temperature': 0}  # Deterministic
    )
    return CategoryResponse.model_validate_json(response['message']['content'])
```

### APScheduler Background Job
```python
# Source: backend/src/backend/scheduler.py (existing pattern)
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

async def process_queue():
    # Process scoring queue batch
    pass

def start_scheduler():
    scheduler.add_job(
        process_queue,
        "interval",
        seconds=30,
        id="scoring_queue",
        replace_existing=True
    )
    scheduler.start()
```

### SQLModel JSON Column
```python
# Source: https://github.com/fastapi/sqlmodel/issues/42
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

class Article(SQLModel, table=True):
    categories: list[str] | None = Field(
        default=None,
        sa_column=Column(JSON)
    )

    class Config:
        arbitrary_types_allowed = True
```

### Chakra UI v3 Form Field
```tsx
// Source: https://chakra-ui.com/docs/components/field
import { Field } from "@/components/ui/field"
import { Textarea } from "@chakra-ui/react"

<Field.Root>
  <Field.Label>Interests</Field.Label>
  <Textarea
    placeholder="Describe your interests..."
    rows={6}
  />
  <Field.HelperText>
    Natural language description
  </Field.HelperText>
</Field.Root>
```

### Composite Score Calculation
```python
def compute_composite_score(
    interest_score: int,
    quality_score: int,
    categories: list[str],
    topic_weights: dict[str, str]
) -> float:
    """
    Compute final score: base_interest × topic_weight × quality_penalty

    Weight mapping:
    - blocked: 0 (skip scoring entirely)
    - low: 0.5
    - neutral: 1.0 (default)
    - medium: 1.5
    - high: 2.0

    Quality penalty: 0.5-1.0 scale (low quality = 0.5, high = 1.0)
    """
    WEIGHT_MULTIPLIERS = {
        "blocked": 0.0,
        "low": 0.5,
        "neutral": 1.0,
        "medium": 1.5,
        "high": 2.0,
    }

    # Average topic weight for article's categories
    category_multiplier = 1.0
    if categories:
        weights = [
            WEIGHT_MULTIPLIERS.get(
                topic_weights.get(cat.lower(), "neutral"),
                1.0
            )
            for cat in categories
        ]
        category_multiplier = sum(weights) / len(weights)

    # Quality as 0.5-1.0 multiplier (score 0 = 0.5, score 10 = 1.0)
    quality_multiplier = 0.5 + (quality_score / 10.0) * 0.5

    return interest_score * category_multiplier * quality_multiplier
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSON parsing from LLM | Pydantic schema enforcement with `format` | Ollama added structured outputs (2025) | Eliminates parsing failures, enforces types at LLM level via GBNF |
| Celery + Redis for background jobs | APScheduler AsyncIOScheduler | FastAPI + small deployments (ongoing) | Single-process async sufficient for home server scale, no broker needed |
| PostgreSQL for JSON workloads | SQLite with JSON1 extension | SQLite 3.45+ JSONB support (2024) | SQLite performance parity with Postgres for reads, simpler deployment |
| Pydantic v1 | Pydantic v2 | 2023 stable | 5-50x performance boost, better FastAPI integration, JSON schema mode control |
| Llama 3.1 | Llama 3.3 / Qwen 2.5 | Late 2024 / Early 2025 | Qwen 2.5 better at structured output/classification, Llama 3.3 faster inference |

**Deprecated/outdated:**
- **Celery for single-server FastAPI:** APScheduler with AsyncIOScheduler is standard for in-process background work (2024+)
- **instructor library (maybe):** Ollama-python native Pydantic support may suffice (verify during implementation)
- **FormControl in Chakra UI:** Replaced by Field component in v3 (2025)

## Open Questions

1. **Should we use instructor library or native ollama-python Pydantic support?**
   - What we know: instructor provides retry logic, better validation, mode configuration
   - What's unclear: Whether ollama-python v0.6.1 `format` parameter is sufficient
   - Recommendation: Start with native `format` parameter (simpler), add instructor if validation issues emerge

2. **Database-backed job store for APScheduler or rely on Article.scoring_state?**
   - What we know: APScheduler supports SQLAlchemy job stores for persistence across restarts
   - What's unclear: Whether queue position needs to survive restart or can rebuild from `scoring_state=queued`
   - Recommendation: Start without job store (simpler). Article model state is sufficient — on restart, reschedule all queued articles.

3. **Model selection: qwen2.5:7b vs :14b vs llama3.3:8b for categorization?**
   - What we know: Qwen better at structured output, 7b loads in ~4GB RAM, 14b needs ~8GB
   - What's unclear: Whether 7b sufficient for categorization or needs 14b nuance
   - Recommendation: Use qwen2.5:7b for categorization (fast), qwen2.5:14b for scoring (nuanced). Test on user's hardware, fall back to 7b for both if memory constrained.

4. **How many default seed categories to ship?**
   - What we know: Target 1-6 per article, LLM should reuse existing
   - What's unclear: Optimal seed count (too few = LLM invents many, too many = confusing UI)
   - Recommendation: Start with 20-30 broad categories (Technology, Science, Politics, Business, Culture, etc.). User can prune via blocking, LLM adds specific ones.

5. **Re-scoring trigger: last 7 days or last N articles?**
   - What we know: User expectation is "recent articles" re-scored on preference save
   - What's unclear: Whether 7 days appropriate for all feed refresh rates (some feeds daily, some hourly)
   - Recommendation: Use last 100 unread articles OR 7 days, whichever is smaller. Prevents re-scoring thousands on first preference save.

## Sources

### Primary (HIGH confidence)
- [Ollama Structured Outputs - Official Docs](https://docs.ollama.com/capabilities/structured-outputs)
- [ollama-python v0.6.1 - GitHub](https://github.com/ollama/ollama-python)
- [Pydantic v2 JSON Schema - Official Docs](https://docs.pydantic.dev/latest/concepts/json_schema/)
- [FastAPI Background Tasks - Official Tutorial](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [SQLite JSON Functions](https://www.sqlite.org/json1.html)
- [Chakra UI v3 Field Component](https://chakra-ui.com/docs/components/field)
- [Chakra UI v3 Textarea](https://chakra-ui.com/docs/components/textarea)
- Existing codebase: `backend/src/backend/scheduler.py`, `backend/src/backend/models.py`, `frontend/src/theme/index.ts`

### Secondary (MEDIUM confidence)
- [FastAPI Background Task Processing 2026 - OneUpTime](https://oneuptime.com/blog/post/2026-02-02-fastapi-background-tasks/view)
- [SQLModel JSON/Array Types - Issue #42](https://github.com/fastapi/sqlmodel/issues/42)
- [Ollama Timeout Issues](https://www.restack.io/p/ollama-answer-timeout-issues-cat-ai)
- [Qwen 2.5 vs Llama 3.3 Comparison](https://www.humai.blog/qwen-2-5-vs-llama-3-3-best-open-source-llms-for-2026/)
- [LLM Multi-Stage Classification Pipeline](https://www.emergentmind.com/topics/multi-stage-llm-based-classification-pipeline)
- [Meta Reels RecSys User Feedback](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/)

### Tertiary (LOW confidence - needs validation)
- [Clickbait Detection via LLMs - arXiv 2601.12019](https://arxiv.org/abs/2601.12019) (quality scoring inspiration)
- [Prompt Engineering Guide 2026 - Lakera](https://www.lakera.ai/blog/prompt-engineering-guide) (general techniques)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - Official docs verified, libraries already in use (Pydantic, APScheduler) or official clients (ollama-python)
- Architecture: **HIGH** - Patterns match existing codebase (APScheduler in `scheduler.py`, SQLModel in `models.py`, Chakra v3 in `theme/`)
- Pitfalls: **MEDIUM** - Most from official docs/issues, hydration mismatch from project MEMORY.md (verified), some anticipated from similar systems
- Model selection: **MEDIUM** - WebSearch + community benchmarks, not tested on user's hardware
- Composite scoring formula: **MEDIUM** - Industry patterns (Meta, YouTube) verified, specific multipliers are recommendation not standard

**Research date:** 2026-02-10
**Valid until:** ~2026-03-10 (30 days - stack is stable, model landscape evolving)

**Areas needing validation during implementation:**
1. Ollama model performance on user's hardware (qwen2.5:7b vs :14b memory/speed)
2. Whether instructor library needed or ollama-python `format` sufficient
3. Optimal batch size for scoring queue (10 articles/batch assumption)
4. Seed category list curation (20-30 recommendation needs user validation)
5. Re-scoring scope (100 articles OR 7 days — test with user's feed volume)
