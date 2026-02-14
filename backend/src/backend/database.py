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


def get_session():
    """FastAPI dependency for database sessions."""
    with Session(engine) as session:
        yield session
