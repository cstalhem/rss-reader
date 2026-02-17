import json
import logging
import shutil
from datetime import datetime
from pathlib import Path

from sqlalchemy import event, inspect, text
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


# --- Legacy column migrations ---


def _migrate_articles_scoring_columns():
    """Add LLM scoring columns to articles table if missing."""
    inspector = inspect(engine)
    existing = {col["name"] for col in inspector.get_columns("articles")}

    new_columns = [
        ("categories", "TEXT"),  # JSON stored as TEXT in SQLite
        ("interest_score", "INTEGER"),
        ("quality_score", "INTEGER"),
        ("composite_score", "REAL"),
        ("score_reasoning", "TEXT"),
        ("scoring_state", "TEXT DEFAULT 'unscored'"),
        ("scored_at", "TIMESTAMP"),
    ]

    with engine.begin() as conn:
        for col_name, col_type in new_columns:
            if col_name not in existing:
                logger.info(f"Adding column articles.{col_name}")
                conn.execute(text(f"ALTER TABLE articles ADD COLUMN {col_name} {col_type}"))


def _recover_stuck_scoring():
    """Reset articles orphaned in 'scoring' state back to 'queued'."""
    with engine.begin() as conn:
        result = conn.execute(
            text("UPDATE articles SET scoring_state = 'queued' WHERE scoring_state = 'scoring'")
        )
        if result.rowcount > 0:
            logger.info(f"Recovered {result.rowcount} articles stuck in scoring state")


def _migrate_ollama_config_columns():
    """Add Ollama runtime config columns to user_preferences and articles tables."""
    inspector = inspect(engine)

    # UserPreferences columns
    if inspector.has_table("user_preferences"):
        existing = {col["name"] for col in inspector.get_columns("user_preferences")}
        prefs_columns = [
            ("ollama_categorization_model", "TEXT"),
            ("ollama_scoring_model", "TEXT"),
            ("ollama_use_separate_models", "BOOLEAN DEFAULT 0"),
        ]
        with engine.begin() as conn:
            for col_name, col_type in prefs_columns:
                if col_name not in existing:
                    logger.info(f"Adding column user_preferences.{col_name}")
                    conn.execute(
                        text(
                            f"ALTER TABLE user_preferences ADD COLUMN {col_name} {col_type}"
                        )
                    )

    # Article columns
    if inspector.has_table("articles"):
        existing = {col["name"] for col in inspector.get_columns("articles")}
        article_columns = [
            ("scoring_priority", "INTEGER DEFAULT 0"),
            ("rescore_mode", "TEXT"),
        ]
        with engine.begin() as conn:
            for col_name, col_type in article_columns:
                if col_name not in existing:
                    logger.info(f"Adding column articles.{col_name}")
                    conn.execute(
                        text(
                            f"ALTER TABLE articles ADD COLUMN {col_name} {col_type}"
                        )
                    )


# --- JSON-to-relational migration ---


def _backup_database():
    """Create a timestamped backup of the SQLite database file."""
    db_path = str(engine.url).replace("sqlite:///", "")
    db_file = Path(db_path)
    if not db_file.exists():
        logger.info("No database file to backup (fresh install)")
        return
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_file.with_name(f"{db_file.stem}_backup_{timestamp}{db_file.suffix}")
    shutil.copy2(db_file, backup_path)
    logger.info(f"Database backup created: {backup_path}")


def _migrate_json_to_relational():
    """Migrate category data from JSON blobs to Category/ArticleCategoryLink tables.

    Reads from the old JSON columns (Article.categories, UserPreferences.topic_weights,
    UserPreferences.category_groups) via raw SQL, creates Category rows and
    ArticleCategoryLink rows, then the caller drops the old columns.

    Fully idempotent: skips data migration if categories table already has rows.
    """
    from backend.prompts import DEFAULT_CATEGORY_HIERARCHY

    inspector = inspect(engine)

    # Guard: if categories table already has data, skip migration
    if inspector.has_table("categories"):
        with engine.begin() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM categories")).scalar()
            if count and count > 0:
                logger.info(f"Categories table already has {count} rows, skipping migration")
                return

    # --- Collect existing JSON data via raw SQL ---

    # Check which old columns still exist
    has_articles_categories = False
    has_topic_weights = False
    has_category_groups = False

    if inspector.has_table("articles"):
        article_cols = {col["name"] for col in inspector.get_columns("articles")}
        has_articles_categories = "categories" in article_cols

    if inspector.has_table("user_preferences"):
        pref_cols = {col["name"] for col in inspector.get_columns("user_preferences")}
        has_topic_weights = "topic_weights" in pref_cols
        has_category_groups = "category_groups" in pref_cols

    # Read article categories
    article_categories: dict[int, list[str]] = {}
    if has_articles_categories:
        with engine.begin() as conn:
            rows = conn.execute(
                text("SELECT id, categories FROM articles WHERE categories IS NOT NULL")
            ).fetchall()
            for row in rows:
                try:
                    cats = json.loads(row[1]) if isinstance(row[1], str) else row[1]
                    if cats:
                        article_categories[row[0]] = cats
                except (json.JSONDecodeError, TypeError):
                    continue

    # Read user preferences JSON blobs
    topic_weights: dict[str, str] = {}
    category_groups: dict = {}
    if has_topic_weights or has_category_groups:
        with engine.begin() as conn:
            cols = []
            if has_topic_weights:
                cols.append("topic_weights")
            if has_category_groups:
                cols.append("category_groups")
            row = conn.execute(
                text(f"SELECT {', '.join(cols)} FROM user_preferences LIMIT 1")
            ).first()
            if row:
                idx = 0
                if has_topic_weights:
                    raw = row[idx]
                    if raw:
                        topic_weights = json.loads(raw) if isinstance(raw, str) else raw
                    idx += 1
                if has_category_groups:
                    raw = row[idx]
                    if raw:
                        category_groups = json.loads(raw) if isinstance(raw, str) else raw

    # If no data at all and no article categories, this is a fresh install
    has_any_data = bool(article_categories) or bool(topic_weights) or bool(category_groups)

    if not has_any_data:
        # Fresh install: seed from DEFAULT_CATEGORY_HIERARCHY
        _seed_categories_from_hierarchy(DEFAULT_CATEGORY_HIERARCHY)
        return

    # --- Build set of unique category slugs ---

    all_slugs: set[str] = set()

    # From article categories
    for cats in article_categories.values():
        for cat in cats:
            all_slugs.add(cat.lower().strip())

    # From topic_weights keys
    for slug in topic_weights:
        all_slugs.add(slug.lower().strip())

    # From category_groups children map (parents + children)
    children_map: dict[str, list[str]] = category_groups.get("children", {})
    for parent, children in children_map.items():
        all_slugs.add(parent.lower().strip())
        for child in children:
            all_slugs.add(child.lower().strip())

    # Discard empty strings
    all_slugs.discard("")

    # Weight name mapping (old -> new)
    weight_name_map = {
        "blocked": "block",
        "low": "reduce",
        "neutral": "normal",
        "medium": "boost",
        "high": "max",
    }

    # Build lookup sets from category_groups
    hidden_set = {s.lower() for s in category_groups.get("hidden_categories", [])}
    seen_set = {s.lower() for s in category_groups.get("seen_categories", [])}
    manually_created_set = {s.lower() for s in category_groups.get("manually_created", [])}

    # Build child-to-parent lookup
    child_to_parent: dict[str, str] = {}
    for parent, children in children_map.items():
        for child in children:
            child_to_parent[child.lower().strip()] = parent.lower().strip()

    # --- First pass: create all categories without parent_id ---

    slug_to_id: dict[str, int] = {}
    with engine.begin() as conn:
        for slug in sorted(all_slugs):
            display_name = kebab_to_display(slug)

            # Resolve weight
            raw_weight = topic_weights.get(slug)
            weight = None
            if raw_weight:
                weight = weight_name_map.get(raw_weight, raw_weight)

            is_hidden = slug in hidden_set
            is_seen = slug in seen_set
            is_manually = slug in manually_created_set

            conn.execute(
                text(
                    "INSERT INTO categories (display_name, slug, weight, is_hidden, is_seen, is_manually_created, created_at) "
                    "VALUES (:display_name, :slug, :weight, :is_hidden, :is_seen, :is_manually_created, :created_at)"
                ),
                {
                    "display_name": display_name,
                    "slug": slug,
                    "weight": weight,
                    "is_hidden": is_hidden,
                    "is_seen": is_seen,
                    "is_manually_created": is_manually,
                    "created_at": datetime.now().isoformat(),
                },
            )
            # Get the inserted row's id
            row = conn.execute(
                text("SELECT id FROM categories WHERE slug = :slug"),
                {"slug": slug},
            ).first()
            if row:
                slug_to_id[slug] = row[0]

    logger.info(f"Created {len(slug_to_id)} categories from JSON data")

    # --- Second pass: set parent_id ---

    if child_to_parent:
        with engine.begin() as conn:
            for child_slug, parent_slug in child_to_parent.items():
                child_id = slug_to_id.get(child_slug)
                parent_id = slug_to_id.get(parent_slug)
                if child_id and parent_id:
                    conn.execute(
                        text("UPDATE categories SET parent_id = :parent_id WHERE id = :id"),
                        {"parent_id": parent_id, "id": child_id},
                    )
        logger.info(f"Set parent_id for {len(child_to_parent)} child categories")

    # --- Create ArticleCategoryLink rows ---

    link_count = 0
    with engine.begin() as conn:
        for article_id, cats in article_categories.items():
            for cat in cats:
                slug = cat.lower().strip()
                category_id = slug_to_id.get(slug)
                if category_id:
                    conn.execute(
                        text(
                            "INSERT OR IGNORE INTO article_category_link (article_id, category_id) "
                            "VALUES (:article_id, :category_id)"
                        ),
                        {"article_id": article_id, "category_id": category_id},
                    )
                    link_count += 1

    logger.info(f"Created {link_count} article-category links")


def _seed_categories_from_hierarchy(hierarchy: dict[str, list[str]]):
    """Seed categories from DEFAULT_CATEGORY_HIERARCHY for fresh installs."""
    slug_to_id: dict[str, int] = {}

    # First pass: create all categories
    with engine.begin() as conn:
        all_slugs: set[str] = set()
        for parent, children in hierarchy.items():
            all_slugs.add(parent)
            all_slugs.update(children)

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
    with engine.begin() as conn:
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


def _drop_old_json_columns():
    """Drop old JSON columns after successful migration to relational tables."""
    inspector = inspect(engine)

    # Drop articles.categories
    if inspector.has_table("articles"):
        article_cols = {col["name"] for col in inspector.get_columns("articles")}
        if "categories" in article_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE articles DROP COLUMN categories"))
                logger.info("Dropped column articles.categories")

    # Drop user_preferences.category_groups and topic_weights
    if inspector.has_table("user_preferences"):
        pref_cols = {col["name"] for col in inspector.get_columns("user_preferences")}
        if "category_groups" in pref_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE user_preferences DROP COLUMN category_groups"))
                logger.info("Dropped column user_preferences.category_groups")
        if "topic_weights" in pref_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE user_preferences DROP COLUMN topic_weights"))
                logger.info("Dropped column user_preferences.topic_weights")


# --- Startup ---


def create_db_and_tables():
    """Initialize database tables and run migrations."""
    SQLModel.metadata.create_all(engine)
    # Add columns that create_all doesn't handle for existing tables
    if inspect(engine).has_table("articles"):
        _migrate_articles_scoring_columns()
        _recover_stuck_scoring()
    # Ollama config migrations (covers both tables)
    _migrate_ollama_config_columns()
    # Backup before destructive migration
    _backup_database()
    # Migrate JSON blobs to relational Category/ArticleCategoryLink tables
    _migrate_json_to_relational()
    # Drop old JSON columns after migration
    _drop_old_json_columns()


def get_session():
    """FastAPI dependency for database sessions."""
    with Session(engine) as session:
        yield session
