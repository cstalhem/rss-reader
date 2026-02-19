import logging
from datetime import datetime

from sqlalchemy import event, text
from sqlmodel import Session, SQLModel, create_engine

from backend.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Construct database URL from settings
DATABASE_URL = f"sqlite:///{settings.database.path}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for FastAPI async
    echo=False,  # Set to True for SQL query logging during development
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Configure SQLite for production use with WAL mode.

    WAL (Write-Ahead Logging) mode prevents database locked errors
    by allowing concurrent reads while writing.
    """
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")  # Enable CASCADE delete
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")  # Wait up to 5s for write lock
    cursor.execute("PRAGMA synchronous=NORMAL")  # Performance optimization
    cursor.execute("PRAGMA cache_size=-64000")  # 64MB cache
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.close()


# --- Smart casing helpers ---

SMART_CASE_MAP = {
    "ai": "AI",
    "ml": "ML",
    "ai-ml": "AI & ML",
    "ios": "iOS",
    "macos": "macOS",
    "imac": "iMac",
    "api": "API",
    "css": "CSS",
    "html": "HTML",
    "sql": "SQL",
    "ui": "UI",
    "ux": "UX",
    "devops": "DevOps",
    "saas": "SaaS",
    "llm": "LLM",
    "gpu": "GPU",
    "cpu": "CPU",
    "vpn": "VPN",
}


def smart_case(display_name: str) -> str:
    """Apply smart casing: check known terms, otherwise title-case."""
    lower = display_name.lower().strip()
    if lower in SMART_CASE_MAP:
        return SMART_CASE_MAP[lower]
    return " ".join(
        SMART_CASE_MAP.get(word.lower(), word.capitalize())
        for word in display_name.replace("-", " ").split()
    )


def kebab_to_display(kebab: str) -> str:
    """Convert kebab-case category slug to a human-readable display name.

    Examples: 'ai-ml' -> 'AI & ML', 'web-development' -> 'Web Development'
    """
    lower = kebab.lower().strip()
    if lower in SMART_CASE_MAP:
        return SMART_CASE_MAP[lower]
    return " ".join(
        SMART_CASE_MAP.get(word, word.capitalize())
        for word in kebab.split("-")
    )


# --- Schema versioning ---

CURRENT_SCHEMA_VERSION = 1


def _get_schema_version(conn) -> int:
    """Get current schema version, creating table if needed."""
    conn.execute(text(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)"
    ))
    row = conn.execute(text("SELECT version FROM schema_version")).first()
    if row is None:
        conn.execute(text("INSERT INTO schema_version (version) VALUES (0)"))
        return 0
    return row[0]


def _set_schema_version(conn, version: int):
    """Set schema version to given value."""
    conn.execute(text("UPDATE schema_version SET version = :v"), {"v": version})


def _recover_stuck_scoring(conn):
    """Reset articles orphaned in 'scoring' state back to 'queued'."""
    result = conn.execute(
        text("UPDATE articles SET scoring_state = 'queued' WHERE scoring_state = 'scoring'")
    )
    if result.rowcount > 0:
        logger.info(f"Recovered {result.rowcount} articles stuck in scoring state")


def _seed_default_categories(conn):
    """Seed default categories from hierarchy if DB has no categories.

    Only runs on fresh installs (empty categories table).
    """
    from backend.prompts import DEFAULT_CATEGORY_HIERARCHY

    count = conn.execute(text("SELECT COUNT(*) FROM categories")).scalar()
    if count and count > 0:
        return

    hierarchy = DEFAULT_CATEGORY_HIERARCHY
    slug_to_id: dict[str, int] = {}

    # Collect all slugs from hierarchy
    all_slugs: set[str] = set()
    for parent, children in hierarchy.items():
        all_slugs.add(parent)
        all_slugs.update(children)

    # First pass: create all categories
    for slug in sorted(all_slugs):
        display_name = kebab_to_display(slug)
        conn.execute(
            text(
                "INSERT INTO categories (display_name, slug, is_seen, created_at) "
                "VALUES (:display_name, :slug, :is_seen, :created_at)"
            ),
            {
                "display_name": display_name,
                "slug": slug,
                "is_seen": True,
                "created_at": datetime.now().isoformat(),
            },
        )
        row = conn.execute(
            text("SELECT id FROM categories WHERE slug = :slug"),
            {"slug": slug},
        ).first()
        if row:
            slug_to_id[slug] = row[0]

    # Second pass: set parent_id
    for parent, children in hierarchy.items():
        parent_id = slug_to_id.get(parent)
        if not parent_id:
            continue
        for child in children:
            child_id = slug_to_id.get(child)
            if child_id:
                conn.execute(
                    text("UPDATE categories SET parent_id = :parent_id WHERE id = :id"),
                    {"parent_id": parent_id, "id": child_id},
                )

    logger.info(f"Seeded {len(slug_to_id)} categories from default hierarchy")


# --- Startup ---


def create_db_and_tables():
    """Initialize database tables and run versioned migrations."""
    SQLModel.metadata.create_all(engine)

    with engine.begin() as conn:
        version = _get_schema_version(conn)

        if version < 1:
            _seed_default_categories(conn)
            _recover_stuck_scoring(conn)
            _set_schema_version(conn, 1)

    logger.info(f"Database ready at schema version {CURRENT_SCHEMA_VERSION}")


def get_session():
    """FastAPI dependency for database sessions.

    NOTE: Canonical version now lives in deps.py. This copy remains until
    main.py imports are updated in Plan 02.
    """
    with Session(engine) as session:
        yield session
