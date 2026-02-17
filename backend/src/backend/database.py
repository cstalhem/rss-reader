import json
import logging

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


def _migrate_category_groups_column():
    """Add category_groups column to user_preferences if missing."""
    inspector = inspect(engine)
    if not inspector.has_table("user_preferences"):
        return

    existing = {col["name"] for col in inspector.get_columns("user_preferences")}
    if "category_groups" not in existing:
        with engine.begin() as conn:
            logger.info("Adding column user_preferences.category_groups")
            conn.execute(
                text("ALTER TABLE user_preferences ADD COLUMN category_groups TEXT")
            )


def _migrate_weight_names():
    """Convert existing topic_weights from old names to new names.

    Mapping: blocked->block, low->reduce, neutral->normal, medium->boost, high->max.
    Also seeds seen_categories in category_groups with all existing topic_weights keys
    to prevent every category showing a 'New' badge on first load.
    """
    name_map = {
        "blocked": "block",
        "low": "reduce",
        "neutral": "normal",
        "medium": "boost",
        "high": "max",
    }

    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT id, topic_weights, category_groups FROM user_preferences LIMIT 1")
        ).first()
        if not row or not row[1]:
            return

        weights = json.loads(row[1]) if isinstance(row[1], str) else row[1]
        changed = False

        new_weights = {}
        for category, weight in weights.items():
            if weight in name_map:
                new_weights[category] = name_map[weight]
                changed = True
            else:
                new_weights[category] = weight

        if changed:
            conn.execute(
                text("UPDATE user_preferences SET topic_weights = :weights WHERE id = :id"),
                {"weights": json.dumps(new_weights), "id": row[0]},
            )
            logger.info("Migrated topic_weights to new weight names")

        # Seed seen_categories from all topic_weights keys to avoid stale "New" badges
        category_groups = json.loads(row[2]) if row[2] else None
        if category_groups is None:
            # Use new children-based structure, not groups array
            category_groups = {
                "children": {},
                "hidden_categories": [],
                "seen_categories": list(weights.keys()),
                "returned_categories": [],
                "manually_created": [],
            }
            conn.execute(
                text("UPDATE user_preferences SET category_groups = :cg WHERE id = :id"),
                {"cg": json.dumps(category_groups), "id": row[0]},
            )
            logger.info(
                f"Seeded category_groups with {len(weights)} seen categories"
            )


def _migrate_groups_to_children():
    """Convert old groups array format to new children map format.

    Converts: groups: [{id, name, weight, categories: [...]}]
    To: children: {parent_name: [child1, child2, ...]}

    Parent categories inherit the group's weight. Name collisions get "-group" suffix.
    """
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT id, topic_weights, category_groups FROM user_preferences LIMIT 1")
        ).first()
        if not row or not row[2]:
            return

        category_groups = json.loads(row[2]) if isinstance(row[2], str) else row[2]

        # Skip if already migrated or fresh (has children key)
        if "children" in category_groups:
            return

        # Skip if no groups to migrate
        if "groups" not in category_groups or not category_groups["groups"]:
            # Restructure to new format with empty children
            category_groups = {
                "children": {},
                "hidden_categories": category_groups.get("hidden_categories", []),
                "seen_categories": category_groups.get("seen_categories", []),
                "returned_categories": category_groups.get("returned_categories", []),
                "manually_created": [],
            }
            conn.execute(
                text("UPDATE user_preferences SET category_groups = :cg WHERE id = :id"),
                {"cg": json.dumps(category_groups), "id": row[0]},
            )
            logger.info("Restructured category_groups to children map format (no groups to migrate)")
            return

        # Migrate groups to children map
        children_map = {}
        topic_weights = json.loads(row[1]) if row[1] else {}
        seen_categories = list(category_groups.get("seen_categories", []))
        existing_categories = {cat.lower() for cat in topic_weights.keys()}

        for group in category_groups["groups"]:
            # Kebab-case the group name
            group_name = group.get("name", "").strip().lower().replace(" ", "-")
            if not group_name:
                continue

            # Check for collision with existing categories
            if group_name in existing_categories:
                group_name = f"{group_name}-group"

            # Map children
            children_map[group_name] = group.get("categories", [])

            # Inherit group weight as parent weight
            group_weight = group.get("weight")
            if group_weight:
                topic_weights[group_name] = group_weight

            # Add parent to seen_categories to avoid "New" badge
            if group_name not in [s.lower() for s in seen_categories]:
                seen_categories.append(group_name)

        # Build new category_groups structure
        new_category_groups = {
            "children": children_map,
            "hidden_categories": category_groups.get("hidden_categories", []),
            "seen_categories": seen_categories,
            "returned_categories": category_groups.get("returned_categories", []),
            "manually_created": [],
        }

        # Write both category_groups and topic_weights
        conn.execute(
            text("UPDATE user_preferences SET category_groups = :cg, topic_weights = :weights WHERE id = :id"),
            {"cg": json.dumps(new_category_groups), "weights": json.dumps(topic_weights), "id": row[0]},
        )
        logger.info(f"Migrated {len(children_map)} groups to children map format")


def _seed_category_hierarchy():
    """Seed DEFAULT_CATEGORY_HIERARCHY for fresh installs.

    Only runs if category_groups is None (truly fresh, no previous data).
    """
    from backend.prompts import DEFAULT_CATEGORY_HIERARCHY

    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT id, category_groups FROM user_preferences LIMIT 1")
        ).first()
        if not row:
            return

        category_groups = json.loads(row[1]) if row[1] else None

        # Only seed if truly fresh (None)
        if category_groups is not None:
            return

        # Collect all parent and child category names for seen_categories
        all_categories = set()
        for parent, children in DEFAULT_CATEGORY_HIERARCHY.items():
            all_categories.add(parent)
            all_categories.update(children)

        seeded_category_groups = {
            "children": DEFAULT_CATEGORY_HIERARCHY,
            "hidden_categories": [],
            "seen_categories": list(all_categories),
            "returned_categories": [],
            "manually_created": [],
        }

        conn.execute(
            text("UPDATE user_preferences SET category_groups = :cg WHERE id = :id"),
            {"cg": json.dumps(seeded_category_groups), "id": row[0]},
        )
        logger.info(f"Seeded category hierarchy with {len(DEFAULT_CATEGORY_HIERARCHY)} parents")


def _seed_default_topic_weights():
    """Backfill topic_weights with defaults if currently NULL."""
    from backend.prompts import get_default_topic_weights

    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT id, topic_weights FROM user_preferences LIMIT 1")
        ).first()
        if row and row[1] is None:
            defaults = json.dumps(get_default_topic_weights())
            conn.execute(
                text("UPDATE user_preferences SET topic_weights = :weights WHERE id = :id"),
                {"weights": defaults, "id": row[0]},
            )
            logger.info("Seeded default topic_weights for existing preferences")


def create_db_and_tables():
    """Initialize database tables and run migrations."""
    SQLModel.metadata.create_all(engine)
    # Add columns that create_all doesn't handle for existing tables
    if inspect(engine).has_table("articles"):
        _migrate_articles_scoring_columns()
        _recover_stuck_scoring()
    if inspect(engine).has_table("user_preferences"):
        _seed_default_topic_weights()
    # Ollama config migrations (covers both tables)
    _migrate_ollama_config_columns()
    # Category grouping migrations
    _migrate_category_groups_column()
    _migrate_weight_names()
    _migrate_groups_to_children()
    _seed_category_hierarchy()


def get_session():
    """FastAPI dependency for database sessions."""
    with Session(engine) as session:
        yield session
