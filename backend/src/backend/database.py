import logging
from pathlib import Path

from slugify import slugify
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
        SMART_CASE_MAP.get(word, word.capitalize()) for word in kebab.split("-")
    )


# --- Schema versioning ---

CURRENT_SCHEMA_VERSION = 2


def _get_schema_version(conn) -> int:
    """Get current schema version, creating table if needed."""
    conn.execute(
        text("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)")
    )
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
        text(
            "UPDATE articles SET scoring_state = 'queued' WHERE scoring_state = 'scoring'"
        )
    )
    if result.rowcount > 0:
        logger.info(f"Recovered {result.rowcount} articles stuck in scoring state")


def _seed_default_categories(conn):
    """Seed default categories from hierarchy if DB has no categories.

    Only runs on fresh installs (empty categories table).
    """
    from backend.models import Category
    from backend.prompts import DEFAULT_CATEGORY_HIERARCHY

    count = conn.execute(text("SELECT COUNT(*) FROM categories")).scalar()
    if count and count > 0:
        return

    hierarchy = DEFAULT_CATEGORY_HIERARCHY
    slug_to_cat: dict[str, Category] = {}

    # Collect all normalized slugs from hierarchy values.
    # This must match runtime category creation (slugify -> lowercase kebab-case)
    # to avoid case-sensitive duplicate rows in SQLite.
    all_slugs: set[str] = set()
    for parent, children in hierarchy.items():
        parent_slug = slugify(parent)
        if parent_slug:
            all_slugs.add(parent_slug)
        for child in children:
            child_slug = slugify(child)
            if child_slug:
                all_slugs.add(child_slug)

    session = Session(bind=conn)

    # First pass: create all categories
    for slug in sorted(all_slugs):
        cat = Category(display_name=kebab_to_display(slug), slug=slug, is_seen=True)
        session.add(cat)
        slug_to_cat[slug] = cat

    session.flush()  # Assigns IDs within existing transaction

    # Second pass: set parent_id
    for parent, children in hierarchy.items():
        parent_slug = slugify(parent)
        parent_cat = slug_to_cat.get(parent_slug)
        if not parent_cat:
            continue
        for child in children:
            child_slug = slugify(child)
            child_cat = slug_to_cat.get(child_slug)
            if child_cat:
                child_cat.parent_id = parent_cat.id

    session.flush()

    logger.info(f"Seeded {len(slug_to_cat)} categories from default hierarchy")


def _run_alembic_migrations():
    """Apply Alembic migrations for schema/data changes after schema_version v2."""
    from alembic.config import Config

    from alembic import command

    project_root = Path(__file__).resolve().parents[2]
    alembic_ini = project_root / "alembic.ini"
    if not alembic_ini.exists():
        logger.warning("Alembic config not found: %s", alembic_ini)
        return

    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    command.upgrade(alembic_cfg, "head")


# --- Startup ---


def create_db_and_tables():
    """Initialize database tables and run migrations.

    Note: `schema_version` remains for historical bootstrap (v1/v2 only).
    New schema/data changes are managed with Alembic.
    """
    SQLModel.metadata.create_all(engine)

    with engine.begin() as conn:
        version = _get_schema_version(conn)

        if version < 1:
            _seed_default_categories(conn)
            _set_schema_version(conn, 1)

        if version < 2:
            # Guard: columns may already exist if create_all() ran on a fresh DB
            existing = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(user_preferences)"))
            }
            # Note: ollama_thinking was added here historically but is now
            # removed by Alembic migration. Skip adding it on fresh installs.
            if "feed_refresh_interval" not in existing:
                conn.execute(
                    text(
                        "ALTER TABLE user_preferences "
                        "ADD COLUMN feed_refresh_interval INTEGER NOT NULL DEFAULT 1800"
                    )
                )
            _set_schema_version(conn, 2)

        # Always recover orphaned "scoring" rows at startup in case the process
        # was interrupted mid-stream.
        _recover_stuck_scoring(conn)

    _run_alembic_migrations()

    logger.info(f"Database ready at schema version {CURRENT_SCHEMA_VERSION}")
