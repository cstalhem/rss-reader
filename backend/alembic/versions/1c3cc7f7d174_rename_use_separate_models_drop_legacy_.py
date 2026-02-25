"""rename_use_separate_models_drop_legacy_columns

Rename ollama_use_separate_models -> use_separate_models and drop legacy
UserPreferences columns that are now superseded by LLMProviderConfig +
LLMTaskRoute tables.

Revision ID: 1c3cc7f7d174
Revises: 8c6f3c9b8f70
Create Date: 2026-02-25 22:46:00.984445

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1c3cc7f7d174"
down_revision: str | Sequence[str] | None = "8c6f3c9b8f70"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEGACY_COLUMNS = [
    "ollama_categorization_model",
    "ollama_scoring_model",
    "ollama_thinking",
    "active_llm_provider",
]


def _column_exists(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    """Rename ollama_use_separate_models and drop legacy columns."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not any(
        t == "user_preferences" for t in inspector.get_table_names()
    ):
        return

    has_old = _column_exists(inspector, "user_preferences", "ollama_use_separate_models")
    has_new = _column_exists(inspector, "user_preferences", "use_separate_models")

    # SQLite doesn't support ALTER COLUMN RENAME directly -- use batch mode
    # which recreates the table.
    with op.batch_alter_table("user_preferences") as batch_op:
        # Rename ollama_use_separate_models -> use_separate_models
        if has_old and not has_new:
            batch_op.alter_column(
                "ollama_use_separate_models",
                new_column_name="use_separate_models",
            )
        elif not has_old and not has_new:
            # Column doesn't exist yet at all -- add it
            batch_op.add_column(
                sa.Column(
                    "use_separate_models",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("0"),
                )
            )

        # Drop legacy columns
        for col in LEGACY_COLUMNS:
            if _column_exists(inspector, "user_preferences", col):
                batch_op.drop_column(col)


def downgrade() -> None:
    """Re-add legacy columns and rename use_separate_models back."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not any(
        t == "user_preferences" for t in inspector.get_table_names()
    ):
        return

    with op.batch_alter_table("user_preferences") as batch_op:
        if _column_exists(inspector, "user_preferences", "use_separate_models"):
            batch_op.alter_column(
                "use_separate_models",
                new_column_name="ollama_use_separate_models",
            )

        for col, col_type, default in [
            ("ollama_categorization_model", sa.String(), None),
            ("ollama_scoring_model", sa.String(), None),
            ("ollama_thinking", sa.Boolean(), sa.text("0")),
            ("active_llm_provider", sa.String(), sa.text("'ollama'")),
        ]:
            if not _column_exists(inspector, "user_preferences", col):
                batch_op.add_column(
                    sa.Column(col, col_type, nullable=True, server_default=default)
                )
