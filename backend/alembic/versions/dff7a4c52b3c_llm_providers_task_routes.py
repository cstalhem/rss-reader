"""llm_providers_task_routes

Revision ID: dff7a4c52b3c
Revises:
Create Date: 2026-02-24 10:04:53.621208

"""

import json
from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa

from alembic import op
from backend.config import get_settings
from backend.llm_providers.ollama import (
    DEFAULT_OLLAMA_BASE_URL,
    DEFAULT_OLLAMA_PORT,
    split_ollama_host,
)

# revision identifiers, used by Alembic.
revision: str = "dff7a4c52b3c"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    columns = inspector.get_columns(table_name)
    return any(column["name"] == column_name for column in columns)


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    indexes = inspector.get_indexes(table_name)
    return any(index["name"] == index_name for index in indexes)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "articles"):
        article_columns = {
            column["name"]: column for column in inspector.get_columns("articles")
        }
        with op.batch_alter_table("articles") as batch_op:
            if article_columns.get("scoring_state", {}).get("nullable", True):
                bind.execute(
                    sa.text(
                        "UPDATE articles SET scoring_state = 'unscored' "
                        "WHERE scoring_state IS NULL"
                    )
                )
                batch_op.alter_column(
                    "scoring_state",
                    existing_type=article_columns["scoring_state"]["type"],
                    nullable=False,
                    existing_server_default=sa.text("'unscored'"),
                )

            if article_columns.get("scoring_priority", {}).get("nullable", True):
                bind.execute(
                    sa.text(
                        "UPDATE articles SET scoring_priority = 0 "
                        "WHERE scoring_priority IS NULL"
                    )
                )
                batch_op.alter_column(
                    "scoring_priority",
                    existing_type=article_columns["scoring_priority"]["type"],
                    nullable=False,
                    existing_server_default=sa.text("0"),
                )

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "articles"):
        if not _index_exists(inspector, "articles", "ix_articles_composite_score"):
            op.create_index(
                "ix_articles_composite_score",
                "articles",
                ["composite_score"],
                unique=False,
            )
        if not _index_exists(inspector, "articles", "ix_articles_scoring_state"):
            op.create_index(
                "ix_articles_scoring_state",
                "articles",
                ["scoring_state"],
                unique=False,
            )

    if _table_exists(inspector, "user_preferences") and not _column_exists(
        inspector, "user_preferences", "active_llm_provider"
    ):
        with op.batch_alter_table("user_preferences") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "active_llm_provider",
                    sa.String(),
                    nullable=False,
                    server_default="ollama",
                )
            )

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "user_preferences") and _column_exists(
        inspector, "user_preferences", "ollama_use_separate_models"
    ):
        user_pref_columns = {
            column["name"]: column
            for column in inspector.get_columns("user_preferences")
        }
        if user_pref_columns.get("ollama_use_separate_models", {}).get(
            "nullable", True
        ):
            bind.execute(
                sa.text(
                    "UPDATE user_preferences SET ollama_use_separate_models = 0 "
                    "WHERE ollama_use_separate_models IS NULL"
                )
            )
            with op.batch_alter_table("user_preferences") as batch_op:
                batch_op.alter_column(
                    "ollama_use_separate_models",
                    existing_type=user_pref_columns["ollama_use_separate_models"][
                        "type"
                    ],
                    nullable=False,
                    existing_server_default=sa.text("0"),
                )

    inspector = sa.inspect(bind)
    if not _table_exists(inspector, "llm_provider_configs"):
        op.create_table(
            "llm_provider_configs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column(
                "enabled", sa.Boolean(), nullable=False, server_default=sa.true()
            ),
            sa.Column("config_json", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.CheckConstraint(
                "json_valid(config_json)", name="ck_llm_provider_configs_config_json"
            ),
        )

    inspector = sa.inspect(bind)
    if not _index_exists(
        inspector, "llm_provider_configs", "ix_llm_provider_configs_provider"
    ):
        op.create_index(
            "ix_llm_provider_configs_provider",
            "llm_provider_configs",
            ["provider"],
            unique=True,
        )

    inspector = sa.inspect(bind)
    if not _table_exists(inspector, "llm_task_routes"):
        op.create_table(
            "llm_task_routes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("task", sa.String(), nullable=False),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column("model", sa.String(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["provider"], ["llm_provider_configs.provider"]),
        )

    inspector = sa.inspect(bind)
    if not _index_exists(inspector, "llm_task_routes", "ix_llm_task_routes_provider"):
        op.create_index(
            "ix_llm_task_routes_provider",
            "llm_task_routes",
            ["provider"],
            unique=False,
        )
    if not _index_exists(inspector, "llm_task_routes", "ix_llm_task_routes_task"):
        op.create_index(
            "ix_llm_task_routes_task",
            "llm_task_routes",
            ["task"],
            unique=True,
        )

    # Backfill provider config and task routes from legacy UserPreferences fields.
    settings = get_settings()
    base_url, port = split_ollama_host(settings.ollama.host)
    if not base_url:
        base_url = DEFAULT_OLLAMA_BASE_URL
    if not port:
        port = DEFAULT_OLLAMA_PORT

    legacy = (
        bind.execute(
            sa.text(
                """
            SELECT
              ollama_categorization_model AS categorization_model,
              ollama_scoring_model AS scoring_model,
              ollama_use_separate_models AS use_separate_models,
              ollama_thinking AS thinking
            FROM user_preferences
            ORDER BY id
            LIMIT 1
            """
            )
        )
        .mappings()
        .first()
    )

    if legacy:
        categorization_model = legacy["categorization_model"]
        scoring_model = legacy["scoring_model"]
        use_separate_models = bool(legacy["use_separate_models"])
        thinking = bool(legacy["thinking"])
    else:
        categorization_model = None
        scoring_model = None
        use_separate_models = False
        thinking = False

    config_json = json.dumps(
        {
            "base_url": base_url,
            "port": port,
            "categorization_model": categorization_model,
            "scoring_model": scoring_model,
            "use_separate_models": use_separate_models,
            "thinking": thinking,
        }
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO llm_provider_configs (provider, enabled, config_json, updated_at)
            SELECT :provider, :enabled, :config_json, :updated_at
            WHERE NOT EXISTS (
              SELECT 1 FROM llm_provider_configs WHERE provider = :provider
            )
            """
        ).bindparams(sa.bindparam("updated_at", type_=sa.DateTime())),
        {
            "provider": "ollama",
            "enabled": True,
            "config_json": config_json,
            "updated_at": datetime.now(),
        },
    )

    bind.execute(
        sa.text(
            """
            UPDATE user_preferences
            SET active_llm_provider = 'ollama'
            WHERE active_llm_provider IS NULL OR active_llm_provider = ''
            """
        )
    )

    scoring_route_model = (
        scoring_model if use_separate_models and scoring_model else categorization_model
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO llm_task_routes (task, provider, model, updated_at)
            SELECT :task, :provider, :model, :updated_at
            WHERE NOT EXISTS (
              SELECT 1 FROM llm_task_routes WHERE task = :task
            )
            """
        ).bindparams(sa.bindparam("updated_at", type_=sa.DateTime())),
        {
            "task": "categorization",
            "provider": "ollama",
            "model": categorization_model,
            "updated_at": datetime.now(),
        },
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO llm_task_routes (task, provider, model, updated_at)
            SELECT :task, :provider, :model, :updated_at
            WHERE NOT EXISTS (
              SELECT 1 FROM llm_task_routes WHERE task = :task
            )
            """
        ).bindparams(sa.bindparam("updated_at", type_=sa.DateTime())),
        {
            "task": "scoring",
            "provider": "ollama",
            "model": scoring_route_model,
            "updated_at": datetime.now(),
        },
    )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "llm_task_routes"):
        op.drop_table("llm_task_routes")

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "llm_provider_configs"):
        op.drop_table("llm_provider_configs")

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "user_preferences") and _column_exists(
        inspector, "user_preferences", "active_llm_provider"
    ):
        with op.batch_alter_table("user_preferences") as batch_op:
            batch_op.drop_column("active_llm_provider")
