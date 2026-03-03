---
name: backend-testing
description: "Backend testing patterns — fixture hierarchy, dependency overrides, factory helpers, monkeypatch vs respx, pure function testing, and migration tests"
---

# Backend Testing

Rules: `.claude/rules/backend.md` → Testing section

## Key Patterns

### 1. Fixture Hierarchy (`conftest.py`)

Three fixtures form the core chain: `test_engine` → `test_session` → `test_client`.

```python
@pytest.fixture(name="test_engine")
def test_engine_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()
```

`StaticPool` forces SQLAlchemy to reuse the same connection for every checkout. Without it, each `Session(engine)` call would open a new connection to `:memory:`, which creates an entirely separate database -- tables created in one connection are invisible to another.

```python
@pytest.fixture(name="test_session")
def test_session_fixture(test_engine):
    with Session(test_engine) as session:
        yield session
```

`test_session` is used for direct DB setup/assertions in tests. `test_client` creates its own sessions via the dependency override (see below).

### 2. Lifespan Handling

`test_client` patches four lifespan side-effects to no-ops BEFORE entering `TestClient(app)`:

```python
@pytest.fixture(name="test_client")
def test_client_fixture(test_engine, monkeypatch):
    monkeypatch.setattr("backend.main.create_db_and_tables", lambda: None)
    monkeypatch.setattr("backend.main.start_scheduler", lambda: None)
    monkeypatch.setattr("backend.main.shutdown_scheduler", lambda: None)

    async def _noop_close():
        pass

    monkeypatch.setattr("backend.main.close_ollama_client", _noop_close)

    def get_test_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
```

Why: without these patches, `TestClient(app)` triggers the real lifespan, which would create the production database, start APScheduler cron jobs, and initialize the Ollama client.

The dependency override replaces `get_session` (imported from `backend.deps`) so every API route gets a session backed by the in-memory test engine instead of the production one.

### 3. Factory Fixtures

`make_feed`, `make_article`, and `make_category` each return a callable with sensible defaults and auto-incrementing counters for unique URLs/slugs:

```python
@pytest.fixture(name="make_feed")
def make_feed_fixture(test_session: Session):
    _counter = 0

    def _make(**overrides) -> Feed:
        nonlocal _counter
        _counter += 1
        defaults = {
            "url": f"https://example.com/feed-{_counter}.xml",
            "title": f"Test Feed {_counter}",
            "last_fetched_at": datetime.now(),
        }
        defaults.update(overrides)
        feed = Feed(**defaults)
        test_session.add(feed)
        test_session.commit()
        test_session.refresh(feed)
        return feed

    return _make
```

Usage:

```python
def test_something(make_feed, make_article):
    feed = make_feed(title="Custom Feed")
    article = make_article(feed_id=feed.id, is_read=True)
```

`make_article` requires `feed_id` as the first positional argument. `make_feed` and `make_category` take only keyword overrides.

### 4. Session Cache Invalidation

`test_client` creates its own sessions via the dependency override. When a test writes via the API and then reads via `test_session`, the session has stale cached objects:

```python
def test_mark_article_read(test_client, sample_articles, test_session):
    article_id = sample_articles[0].id
    test_client.patch(f"/api/articles/{article_id}", json={"is_read": True})

    # WRONG: test_session still has the old cached object
    # db_article = test_session.get(Article, article_id)

    # RIGHT: expire the cache first
    db_article = test_session.get(Article, article_id)
    test_session.refresh(db_article)  # single object
    assert db_article.is_read is True
```

Use `test_session.expire_all()` to invalidate everything, or `test_session.refresh(obj)` for a single object.

### 5. Mocking External Dependencies

Two patterns depending on what layer you're testing:

**`monkeypatch.setattr`** -- replaces an entire function. Good for testing business logic above the fetch layer:

```python
def test_create_feed(test_client, monkeypatch):
    async def fake_fetch_feed(_url: str):
        return _ParsedFeed()

    def fake_save_articles(_session, _feed_id, _entries):
        return (1, [])

    monkeypatch.setattr("backend.routers.feeds.fetch_feed", fake_fetch_feed)
    monkeypatch.setattr("backend.routers.feeds.save_articles", fake_save_articles)

    response = test_client.post("/api/feeds", json={"url": "https://example.com/feed.xml"})
    assert response.status_code == 201
```

The patch path must reference the module where the function is **used** (e.g. `backend.routers.feeds.fetch_feed`), not where it's defined.

**`respx`** -- intercepts at the httpx transport layer. Good for testing `fetch_feed` itself (error codes, timeouts, malformed responses). The `respx` library is installed but no shared fixture exists yet. Use it directly:

```python
import respx

@respx.mock
def test_fetch_feed_timeout():
    respx.get("https://example.com/feed.xml").mock(side_effect=httpx.ReadTimeout(""))
    # call fetch_feed and assert it handles the timeout
```

### 6. Async Test Pattern

Use `@pytest.mark.asyncio` only on `async def` test functions that directly `await` something:

```python
@pytest.mark.asyncio
async def test_evaluate_task_readiness_model_missing(test_session, monkeypatch):
    # ... setup ...
    runtime = await evaluate_task_readiness(test_session, TASK_CATEGORIZATION)
    assert runtime.ready is False
```

NOT needed for tests using `TestClient` -- it's synchronous even when calling async endpoints:

```python
# No @pytest.mark.asyncio needed here
def test_list_articles(test_client):
    response = test_client.get("/api/articles")
    assert response.status_code == 200
```

`asyncio_mode = "strict"` is configured in `pyproject.toml`, so unmarked async tests will error rather than silently run.

### 7. Pure Function Testing

The `test_scoring.py` pattern: construct model objects manually (no DB, no client), test pure functions directly. Use a local helper like `_make_category()` that sets relationship attributes without persistence:

```python
def _make_category(
    weight: str | None = None,
    is_hidden: bool = False,
    parent: Category | None = None,
) -> Category:
    cat = Category(
        id=1, display_name="test", slug="test",
        weight=weight, is_hidden=is_hidden,
        parent_id=parent.id if parent else None,
    )
    cat.parent = parent  # type: ignore[assignment]
    return cat


def test_effective_weight_inherits_parent():
    parent = _make_category(weight="reduce")
    child = _make_category(parent=parent)
    assert get_effective_weight(child) == "reduce"
```

No fixtures needed -- objects are constructed inline and never touch the database.

### 8. Migration Testing

`test_migrations.py` uses raw `sqlite3.connect()` to create pre-migration schemas, then runs `alembic.command.upgrade()`:

```python
BACKEND_ROOT = Path(__file__).resolve().parents[1]

def _make_alembic_config(db_path: Path) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    return config

def test_upgrade_head_backfills_provider_and_routes():
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db_path = Path(tmp.name)
        _create_pre_feature_schema(db_path)       # raw sqlite3 DDL

        cfg = _make_alembic_config(db_path)
        command.upgrade(cfg, "head")

        with sqlite3.connect(db_path) as conn:
            # assert on migrated state with raw SQL
```

These tests use real temp files (not `:memory:`) because Alembic needs file paths for its `sqlalchemy.url` config. They don't use any conftest fixtures -- each test is fully self-contained with its own pre-migration schema and temp database.

## Anti-Patterns

- **Importing `get_session` from wrong module** -- must be from `backend.deps` (same function object routers use). Importing from another module creates a different function object and `dependency_overrides` won't match.
- **`@pytest.mark.asyncio` on sync TestClient tests** -- unnecessary and misleading. `TestClient` runs an internal event loop; the test function itself is synchronous.
- **Sharing DB state between tests** -- each test gets a fresh in-memory database via the `test_engine` fixture. Don't rely on data from another test.
- **Mocking database calls** -- use real SQLite test databases via fixtures. Mocking `session.exec()` etc. hides real query bugs.
- **`:memory:` SQLite without `StaticPool`** -- tables created in one connection are invisible to another. `StaticPool` forces connection reuse so the in-memory DB is shared.
- **`asyncio_mode = "auto"`** -- keep `"strict"` so every async test requires an explicit `@pytest.mark.asyncio` mark. Auto mode hides which tests are actually async.

## Decision Aids

| Scenario | Use |
|----------|-----|
| Testing API endpoint behavior | `TestClient` + `test_client` fixture |
| Testing async function directly | `@pytest.mark.asyncio` + `await` the function |
| Testing pure function (no DB, no I/O) | Direct function call, construct objects manually |
| Verifying DB state after API call | `test_session.expire_all()` then query |
| Mocking a function the router calls | `monkeypatch.setattr("backend.routers.module.func", fake)` |
| Mocking HTTP responses at transport layer | `respx` mock decorator or context manager |
| Testing Alembic migrations | Raw `sqlite3` setup + `alembic.command.upgrade()` |
| Need test data for a single test file | Per-file `_create_entity()` helper (rare) |
| Need test data across many test files | Factory fixture in `conftest.py` (`make_feed`, etc.) |
