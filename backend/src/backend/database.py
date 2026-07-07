import logging
from pathlib import Path

from slugify import slugify
from sqlalchemy import event, text
from sqlmodel import Session, create_engine

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


# Default category hierarchy for new installs (parent -> children)
DEFAULT_CATEGORY_HIERARCHY: dict[str, list[str]] = {
    "Technology": ["Cybersecurity", "AI", "Programming"],
    "Science": ["Climate", "Space"],
    "Business": ["Finance", "Startups"],
    "Entertainment": ["Gaming", "Film", "Music"],
    "Culture": ["Philosophy", "History", "Design"],
    "Health": [],
    "Politics": ["Law"],
    "Education": [],
}


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


def _recover_stuck_scoring(conn):
    """Reset articles orphaned in 'scoring' or 'categorizing' state back to queued."""
    result = conn.execute(
        text(
            "UPDATE articles SET scoring_state = 'queued' WHERE scoring_state = 'scoring'"
        )
    )
    if result.rowcount > 0:
        logger.info(f"Recovered {result.rowcount} articles stuck in scoring state")

    result2 = conn.execute(
        text(
            "UPDATE articles SET categorization_state = 'queued' WHERE categorization_state = 'categorizing'"
        )
    )
    if result2.rowcount > 0:
        logger.info(
            f"Recovered {result2.rowcount} articles stuck in categorizing state"
        )


def _seed_default_categories(conn):
    """Seed default categories from hierarchy if DB has no categories.

    Only runs on fresh installs (empty categories table).
    """
    from backend.models import Category

    count = conn.execute(text("SELECT COUNT(*) FROM categories")).scalar()
    if count:
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
        cat = Category(display_name=kebab_to_display(slug), slug=slug)
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
    """Bring the database to head via the v2 baseline chain (works from empty)."""
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
    """Initialize the database: migrate to head, then seed and recover."""
    _run_alembic_migrations()

    with engine.begin() as conn:
        _seed_default_categories(conn)
        _recover_stuck_scoring(conn)

    logger.info("Database ready")
