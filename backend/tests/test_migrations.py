"""Alembic migration tests for LLM provider schema rollout."""

import json
import sqlite3
import tempfile
from pathlib import Path

from alembic.config import Config

from alembic import command

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _make_alembic_config(db_path: Path) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    return config


def _create_pre_feature_schema(db_path: Path) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE user_preferences (
              id INTEGER PRIMARY KEY,
              interests TEXT NOT NULL DEFAULT '',
              anti_interests TEXT NOT NULL DEFAULT '',
              updated_at TIMESTAMP NOT NULL,
              ollama_categorization_model TEXT,
              ollama_scoring_model TEXT,
              ollama_use_separate_models BOOLEAN NOT NULL DEFAULT 0,
              ollama_thinking BOOLEAN NOT NULL DEFAULT 0,
              feed_refresh_interval INTEGER NOT NULL DEFAULT 1800
            );

            INSERT INTO user_preferences (
              interests,
              anti_interests,
              updated_at,
              ollama_categorization_model,
              ollama_scoring_model,
              ollama_use_separate_models,
              ollama_thinking,
              feed_refresh_interval
            ) VALUES (
              'ai',
              'crypto',
              '2026-02-24 00:00:00',
              'qwen3:4b',
              'qwen3:8b',
              1,
              1,
              1800
            );
            """
        )


def _create_category_dup_schema_at_dff(db_path: Path) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE categories (
              id INTEGER PRIMARY KEY,
              display_name TEXT NOT NULL,
              slug TEXT NOT NULL,
              parent_id INTEGER,
              weight TEXT,
              is_hidden BOOLEAN NOT NULL DEFAULT 0,
              is_seen BOOLEAN NOT NULL DEFAULT 0,
              is_manually_created BOOLEAN NOT NULL DEFAULT 0,
              created_at TIMESTAMP NOT NULL
            );
            CREATE UNIQUE INDEX ix_categories_slug ON categories (slug);

            CREATE TABLE article_category_link (
              article_id INTEGER NOT NULL,
              category_id INTEGER NOT NULL,
              PRIMARY KEY (article_id, category_id)
            );

            CREATE TABLE alembic_version (
              version_num VARCHAR(32) NOT NULL,
              CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            );
            INSERT INTO alembic_version (version_num) VALUES ('dff7a4c52b3c');
            """
        )

        categories = [
            # Canonical defaults seeded with title-case slugs.
            (2, "Business", "Business", None, None, 0, 1, 0, "2026-02-24 00:00:00"),
            (10, "Finance", "Finance", 2, None, 0, 1, 0, "2026-02-24 00:00:00"),
            (22, "Technology", "Technology", None, None, 0, 1, 0, "2026-02-24 00:00:00"),
            (
                18,
                "Programming",
                "Programming",
                22,
                None,
                0,
                1,
                0,
                "2026-02-24 00:00:00",
            ),
            # Duplicates created later with lowercase slugify slugs.
            (23, "Business", "business", None, "boost", 0, 0, 1, "2026-02-24 00:01:00"),
            (24, "Finance", "finance", 23, None, 0, 0, 0, "2026-02-24 00:01:00"),
            (
                25,
                "Technology",
                "technology",
                None,
                None,
                0,
                0,
                0,
                "2026-02-24 00:01:00",
            ),
            (
                34,
                "Programming",
                "programming",
                25,
                None,
                0,
                0,
                0,
                "2026-02-24 00:01:00",
            ),
        ]
        conn.executemany(
            """
            INSERT INTO categories (
              id, display_name, slug, parent_id, weight, is_hidden, is_seen,
              is_manually_created, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            categories,
        )

        links = [
            (1, 2),
            (1, 23),
            (2, 24),
            (3, 18),
            (3, 34),
        ]
        conn.executemany(
            "INSERT INTO article_category_link (article_id, category_id) VALUES (?, ?)",
            links,
        )


def test_upgrade_head_backfills_provider_and_routes() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db_path = Path(tmp.name)
        _create_pre_feature_schema(db_path)

        cfg = _make_alembic_config(db_path)
        command.upgrade(cfg, "head")

        with sqlite3.connect(db_path) as conn:
            provider_row = conn.execute(
                "SELECT provider, enabled, config_json FROM llm_provider_configs "
                "WHERE provider = 'ollama'"
            ).fetchone()
            assert provider_row is not None
            assert provider_row[0] == "ollama"
            assert provider_row[1] == 1

            config_json = json.loads(provider_row[2])
            assert config_json["categorization_model"] == "qwen3:4b"
            assert config_json["scoring_model"] == "qwen3:8b"
            assert config_json["use_separate_models"] is True
            assert config_json["thinking"] is True

            routes = conn.execute(
                "SELECT task, provider, model FROM llm_task_routes ORDER BY task"
            ).fetchall()
            assert routes == [
                ("categorization", "ollama", "qwen3:4b"),
                ("scoring", "ollama", "qwen3:8b"),
            ]

            # Verify legacy columns are removed by the final migration
            col_names = [
                row[1] for row in conn.execute("PRAGMA table_info(user_preferences)")
            ]
            assert "active_llm_provider" not in col_names
            assert "ollama_categorization_model" not in col_names
            assert "ollama_scoring_model" not in col_names
            assert "ollama_thinking" not in col_names
            assert "use_separate_models" in col_names


def test_upgrade_head_is_idempotent_at_head() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db_path = Path(tmp.name)
        _create_pre_feature_schema(db_path)

        cfg = _make_alembic_config(db_path)
        command.upgrade(cfg, "head")
        command.upgrade(cfg, "head")

        with sqlite3.connect(db_path) as conn:
            routes = conn.execute("SELECT COUNT(*) FROM llm_task_routes").fetchone()
            assert routes == (2,)

            providers = conn.execute(
                "SELECT COUNT(*) FROM llm_provider_configs WHERE provider = 'ollama'"
            ).fetchone()
            assert providers == (1,)


def test_upgrade_head_normalizes_and_dedupes_categories() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db_path = Path(tmp.name)
        _create_category_dup_schema_at_dff(db_path)

        cfg = _make_alembic_config(db_path)
        command.upgrade(cfg, "head")

        with sqlite3.connect(db_path) as conn:
            dupes = conn.execute(
                """
                SELECT lower(slug), COUNT(*)
                FROM categories
                GROUP BY lower(slug)
                HAVING COUNT(*) > 1
                """
            ).fetchall()
            assert dupes == []

            non_normalized = conn.execute(
                "SELECT COUNT(*) FROM categories WHERE slug != lower(slug)"
            ).fetchone()
            assert non_normalized == (0,)

            categories = conn.execute(
                """
                SELECT id, display_name, slug, parent_id, weight, is_seen, is_manually_created
                FROM categories
                ORDER BY id
                """
            ).fetchall()
            assert categories == [
                (2, "Business", "business", None, "boost", 1, 1),
                (10, "Finance", "finance", 2, None, 1, 0),
                (18, "Programming", "programming", 22, None, 1, 0),
                (22, "Technology", "technology", None, None, 1, 0),
            ]

            links = conn.execute(
                """
                SELECT article_id, category_id
                FROM article_category_link
                ORDER BY article_id, category_id
                """
            ).fetchall()
            assert links == [(1, 2), (2, 10), (3, 18)]
