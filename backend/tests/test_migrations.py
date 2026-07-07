"""Alembic migration tests for the v2 baseline chain.

The v2 schema starts a fresh chain (ADR-0003): a single baseline migration
must bring an empty database to the full schema.
"""

import sqlite3
import tempfile
from pathlib import Path

import pytest
from alembic.config import Config

from alembic import command

BACKEND_ROOT = Path(__file__).resolve().parents[1]

EXPECTED_TABLES = {
    "feeds",
    "articles",
    "categories",
    "article_category_link",
    "category_aliases",
    "feedback_events",
    "user_preferences",
    "feed_folders",
}

V1_TABLES = {"llm_provider_configs", "llm_task_routes"}


def _make_alembic_config(db_path: Path) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    return config


def _upgraded_db():
    """Context manager helper: yields a sqlite3 connection to a freshly migrated DB."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db")
    db_path = Path(tmp.name)
    command.upgrade(_make_alembic_config(db_path), "head")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=ON")
    return tmp, conn


def test_fresh_db_migrates_from_empty():
    tmp, conn = _upgraded_db()
    with tmp, conn:
        tables = {
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        assert EXPECTED_TABLES <= tables
        assert not (V1_TABLES & tables)

        # Exactly one revision in the chain — the baseline
        versions = conn.execute("SELECT version_num FROM alembic_version").fetchall()
        assert len(versions) == 1


def test_upgrade_is_idempotent_at_head():
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db_path = Path(tmp.name)
        cfg = _make_alembic_config(db_path)
        command.upgrade(cfg, "head")
        command.upgrade(cfg, "head")


def _insert_feed_and_article(conn) -> int:
    conn.execute(
        "INSERT INTO feeds (url, title, display_order, is_aggregator) VALUES ('u', 't', 0, 0)"
    )
    feed_id = conn.execute("SELECT id FROM feeds").fetchone()[0]
    conn.execute(
        "INSERT INTO articles (feed_id, title, url, is_read, scoring_state, "
        "scoring_priority, categorization_state, categorization_attempts, scoring_attempts) "
        "VALUES (?, 'a', 'https://example.com/a', 0, 'unscored', 0, 'uncategorized', 0, 0)",
        (feed_id,),
    )
    return conn.execute("SELECT id FROM articles").fetchone()[0]


def test_check_constraints_enforced():
    tmp, conn = _upgraded_db()
    with tmp, conn:
        article_id = _insert_feed_and_article(conn)

        # weight is a closed vocabulary
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO categories (display_name, slug, weight, needs_triage, created_at) "
                "VALUES ('X', 'x', 'hidden', 0, CURRENT_TIMESTAMP)"
            )

        # event_type is a closed vocabulary
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO feedback_events (article_id, event_type, created_at) "
                f"VALUES ({article_id}, 'clicked', CURRENT_TIMESTAMP)"
            )

        # rating is ±1 only
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(f"UPDATE articles SET rating = 3 WHERE id = {article_id}")

        # scoring_state is a closed vocabulary
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                f"UPDATE articles SET scoring_state = 'pending' WHERE id = {article_id}"
            )

        # valid values pass
        conn.execute(
            "INSERT INTO categories (display_name, slug, weight, needs_triage, created_at) "
            "VALUES ('AI', 'ai', 'normal', 1, CURRENT_TIMESTAMP)"
        )
        conn.execute(
            "INSERT INTO feedback_events (article_id, event_type, value, created_at) "
            f"VALUES ({article_id}, 'rated', -1, CURRENT_TIMESTAMP)"
        )
        conn.execute(f"UPDATE articles SET rating = 1 WHERE id = {article_id}")


def test_feedback_events_cascade_on_article_delete():
    tmp, conn = _upgraded_db()
    with tmp, conn:
        article_id = _insert_feed_and_article(conn)
        conn.execute(
            "INSERT INTO feedback_events (article_id, event_type, created_at) "
            f"VALUES ({article_id}, 'opened', CURRENT_TIMESTAMP)"
        )
        conn.execute(f"DELETE FROM articles WHERE id = {article_id}")
        remaining = conn.execute("SELECT COUNT(*) FROM feedback_events").fetchone()
        assert remaining == (0,)


def test_alias_target_set_null_on_category_delete():
    """Deleting a target category degrades its aliases into discards (target NULL)."""
    tmp, conn = _upgraded_db()
    with tmp, conn:
        conn.execute(
            "INSERT INTO categories (display_name, slug, weight, needs_triage, created_at) "
            "VALUES ('AI', 'ai', 'normal', 0, CURRENT_TIMESTAMP)"
        )
        cat_id = conn.execute("SELECT id FROM categories").fetchone()[0]
        conn.execute(
            "INSERT INTO category_aliases (alias_slug, target_id, created_at) "
            f"VALUES ('machine-learning', {cat_id}, CURRENT_TIMESTAMP)"
        )
        conn.execute(f"DELETE FROM categories WHERE id = {cat_id}")
        row = conn.execute(
            "SELECT alias_slug, target_id FROM category_aliases"
        ).fetchone()
        assert row == ("machine-learning", None)
