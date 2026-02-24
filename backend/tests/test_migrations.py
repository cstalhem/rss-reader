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

            active_provider = conn.execute(
                "SELECT active_llm_provider FROM user_preferences LIMIT 1"
            ).fetchone()
            assert active_provider == ("ollama",)


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
