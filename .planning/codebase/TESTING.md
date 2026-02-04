# Testing Patterns

**Analysis Date:** 2026-02-04

## Test Framework

**Runner:**
- pytest 9.0.2+
- Config: `pyproject.toml` (minimal config, uses pytest defaults)

**Async Support:**
- pytest-asyncio 1.3.0+ for async test support

**Assertion Library:**
- pytest built-in assertions (no separate library needed)

**Run Commands:**
```bash
pytest                          # Run all tests
pytest -v                       # Verbose output
pytest tests/                   # Run specific test directory
pytest tests/test_api.py        # Run specific test file
pytest tests/test_api.py::test_root  # Run specific test
pytest --asyncio-mode=auto     # Force async mode if needed
```

## Test File Organization

**Location:**
- Test files in `/Users/cstalhem/projects/rss-reader/backend/tests/`
- Pattern: Tests are separated from source code (not co-located)

**Naming:**
- Test files prefixed with `test_`: `test_api.py`, `conftest.py`
- Test functions prefixed with `test_`: `test_root`, `test_list_articles_empty`
- Test function names are descriptive: `test_list_articles_pagination`, `test_mark_article_read`

**Structure:**
```
backend/
├── src/backend/          # Source code
│   ├── __init__.py
│   ├── main.py           # FastAPI app and endpoints
│   ├── models.py         # SQLModel definitions
│   ├── database.py       # Database config
│   ├── feeds.py          # Feed processing logic
│   └── scheduler.py      # Background jobs
└── tests/                # Test directory
    ├── conftest.py       # Pytest fixtures
    └── test_api.py       # API endpoint tests
```

## Test Structure

**Suite Organization:**
Tests are organized by feature/endpoint, not by module. All API tests in `test_api.py`:

```python
def test_root(test_client: TestClient):
    """Test health check endpoint."""
    response = test_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
```

**Patterns:**
- Setup via pytest fixtures (see Fixtures and Factories section)
- Teardown handled automatically by fixture cleanup
- Each test is independent (fixtures create fresh database state)
- Assertions use pytest style: `assert response.status_code == 200`

## Mocking

**Framework:** No explicit mocking library used yet

**Current Testing Approach:**
- Uses TestClient with dependency override instead of mocking
- Example from `conftest.py`:
  ```python
  @pytest.fixture(name="test_client")
  def test_client_fixture(test_engine):
      """Create a TestClient with dependency override for database session."""
      def get_test_session():
          with Session(test_engine) as session:
              yield session

      app.dependency_overrides[get_session] = get_test_session

      with TestClient(app) as client:
          yield client

      app.dependency_overrides.clear()
  ```

**What to Mock:**
- Currently: Nothing is mocked (full integration tests used)
- Future consideration: External HTTP calls in `refresh_feed` could be mocked using `unittest.mock` or `pytest-mock`

**What NOT to Mock:**
- Database interactions - use test database fixture instead
- FastAPI dependency injection - override dependencies using `app.dependency_overrides`

## Fixtures and Factories

**Test Data:**
Fixtures in `/Users/cstalhem/projects/rss-reader/backend/tests/conftest.py`:

```python
@pytest.fixture(name="test_engine")
def test_engine_fixture():
    """Create a test database engine using a temporary SQLite file."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        database_url = f"sqlite:///{tmp.name}"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(name="sample_feed")
def sample_feed_fixture(test_session: Session):
    """Insert a sample feed into the test database."""
    feed = Feed(
        url="https://example.com/feed.xml",
        title="Test Feed",
        last_fetched_at=datetime.now(),
    )
    test_session.add(feed)
    test_session.commit()
    test_session.refresh(feed)
    return feed


@pytest.fixture(name="sample_articles")
def sample_articles_fixture(test_session: Session, sample_feed: Feed):
    """Insert sample articles into the test database."""
    now = datetime.now()
    articles = [
        Article(
            feed_id=sample_feed.id,
            title="Recent Article",
            url="https://example.com/recent",
            author="Test Author",
            published_at=now - timedelta(hours=1),
            summary="A recent article summary",
            content="Full content of recent article",
            is_read=False,
        ),
        # ... more articles
    ]
    for article in articles:
        test_session.add(article)
    test_session.commit()
    for article in articles:
        test_session.refresh(article)
    return articles
```

**Location:**
- All fixtures in `/Users/cstalhem/projects/rss-reader/backend/tests/conftest.py`
- Fixtures follow pytest naming convention: `fixture_name_fixture`
- Decorated with `@pytest.fixture(name="...")`

**Fixture Dependencies:**
- `test_engine` - base fixture for database
- `test_session` - depends on `test_engine`, provides database session
- `test_client` - depends on `test_engine`, provides TestClient with overridden dependencies
- `sample_feed` - depends on `test_session`, creates sample feed
- `sample_articles` - depends on `test_session` and `sample_feed`, creates sample articles

## Coverage

**Requirements:** None enforced (no coverage configuration in `pyproject.toml`)

**View Coverage:**
```bash
pip install coverage
coverage run -m pytest
coverage report
coverage html  # generates htmlcov/index.html
```

## Test Types

**Unit Tests:**
- Not explicitly separated from integration tests
- Functions like `_parse_published_date` are tested indirectly through integration tests
- Example: `test_list_articles_with_data` tests article parsing and storage together

**Integration Tests:**
- All tests in `test_api.py` are integration tests
- Tests use full application stack: FastAPI app → database → business logic
- Scope: Full request/response cycle through API

**E2E Tests:**
- Not implemented
- Would test user workflows across frontend and backend together
- Frontend-only tests: Not detected (no test files in frontend/)

## Common Patterns

**Test Structure Pattern:**
```python
def test_name(test_client: TestClient, sample_articles):
    """Test description."""
    # Arrange - data already set up via fixtures
    article_id = sample_articles[0].id

    # Act
    response = test_client.get(f"/api/articles/{article_id}")

    # Assert
    assert response.status_code == 200
    article = response.json()
    assert article["id"] == article_id
```

**Async Testing:**
```python
@pytest.mark.asyncio
async def test_refresh_feed(test_client: TestClient, sample_feed):
    """Test manual feed refresh endpoint."""
    response = test_client.post("/api/feeds/refresh")
    assert response.status_code == 200
```

Note: The async test still uses `test_client` (sync TestClient), not making actual async calls directly.

**Error Testing:**
```python
def test_get_article_not_found(test_client: TestClient):
    """Test getting a non-existent article returns 404."""
    response = test_client.get("/api/articles/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
```

**Persistence Testing:**
```python
def test_mark_article_read(test_client: TestClient, sample_articles, test_session: Session):
    """Test marking an article as read."""
    article_id = sample_articles[0].id

    # Act through API
    response = test_client.patch(
        f"/api/articles/{article_id}",
        json={"is_read": True}
    )
    assert response.status_code == 200

    # Verify in database
    db_article = test_session.get(Article, article_id)
    test_session.refresh(db_article)
    assert db_article.is_read is True
```

## Test Coverage Analysis

**Currently Tested:**
- Root endpoint (`GET /`)
- List articles (`GET /api/articles`) - empty and with data
- Pagination (`skip` and `limit` parameters)
- Get single article (`GET /api/articles/{article_id}`)
- Article not found cases (404 errors)
- Update article read status (`PATCH /api/articles/{article_id}`)
- Mark read and unread workflows
- Feed refresh endpoint (`POST /api/feeds/refresh`)

**Not Tested (Gaps):**
- Feed fetching logic in `feeds.py` (fetch_feed, save_articles functions)
- Scheduler initialization and background jobs
- Database connection edge cases
- Malformed feed handling (bozo flag processing)
- Feed title updates during refresh
- Error conditions in feed fetching (network errors, timeouts)
- Header parsing in `_parse_published_date` with various formats
- Database constraint violations (duplicate URLs)

---

*Testing analysis: 2026-02-04*
