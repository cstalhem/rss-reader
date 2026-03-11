"""add_categorization_state

Revision ID: bd9b8b970fb9
Revises: 154075cd3c1a
Create Date: 2026-03-11 08:57:15.399180

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bd9b8b970fb9"
down_revision: str | Sequence[str] | None = "154075cd3c1a"
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
    """Add categorization_state, attempt counters, and batch_size columns."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # --- articles: categorization_state, categorization_attempts, scoring_attempts ---
    if _table_exists(inspector, "articles"):
        if not _column_exists(inspector, "articles", "categorization_state"):
            with op.batch_alter_table("articles") as batch_op:
                batch_op.add_column(
                    sa.Column(
                        "categorization_state",
                        sa.Text(),
                        nullable=False,
                        server_default=sa.text("'uncategorized'"),
                    )
                )

        if not _column_exists(inspector, "articles", "categorization_attempts"):
            with op.batch_alter_table("articles") as batch_op:
                batch_op.add_column(
                    sa.Column(
                        "categorization_attempts",
                        sa.Integer(),
                        nullable=False,
                        server_default=sa.text("0"),
                    )
                )

        if not _column_exists(inspector, "articles", "scoring_attempts"):
            with op.batch_alter_table("articles") as batch_op:
                batch_op.add_column(
                    sa.Column(
                        "scoring_attempts",
                        sa.Integer(),
                        nullable=False,
                        server_default=sa.text("0"),
                    )
                )

        # Refresh inspector after adding columns
        inspector = sa.inspect(bind)
        if not _index_exists(inspector, "articles", "ix_articles_categorization_state"):
            op.create_index(
                "ix_articles_categorization_state",
                "articles",
                ["categorization_state"],
            )

        # Backfill categorization_state based on scoring_state
        bind.execute(
            sa.text(
                "UPDATE articles SET categorization_state = 'categorized' "
                "WHERE scoring_state = 'scored'"
            )
        )
        bind.execute(
            sa.text(
                "UPDATE articles SET categorization_state = 'queued', scoring_state = 'unscored' "
                "WHERE scoring_state IN ('queued', 'scoring')"
            )
        )
        bind.execute(
            sa.text(
                "UPDATE articles SET categorization_state = 'uncategorized' "
                "WHERE scoring_state = 'failed'"
            )
        )

    # --- llm_task_routes: batch_size ---
    inspector = sa.inspect(bind)
    if _table_exists(inspector, "llm_task_routes") and not _column_exists(
        inspector, "llm_task_routes", "batch_size"
    ):
        with op.batch_alter_table("llm_task_routes") as batch_op:
            batch_op.add_column(sa.Column("batch_size", sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove categorization_state, attempt counters, and batch_size columns."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Reverse backfill: restore scoring_state for queued articles
    bind.execute(
        sa.text(
            "UPDATE articles SET scoring_state = 'queued' "
            "WHERE categorization_state = 'queued' AND scoring_state = 'unscored'"
        )
    )

    if _table_exists(inspector, "articles"):
        if _index_exists(inspector, "articles", "ix_articles_categorization_state"):
            op.drop_index("ix_articles_categorization_state", table_name="articles")

        inspector = sa.inspect(bind)
        if _column_exists(inspector, "articles", "scoring_attempts"):
            with op.batch_alter_table("articles") as batch_op:
                batch_op.drop_column("scoring_attempts")

        inspector = sa.inspect(bind)
        if _column_exists(inspector, "articles", "categorization_attempts"):
            with op.batch_alter_table("articles") as batch_op:
                batch_op.drop_column("categorization_attempts")

        inspector = sa.inspect(bind)
        if _column_exists(inspector, "articles", "categorization_state"):
            with op.batch_alter_table("articles") as batch_op:
                batch_op.drop_column("categorization_state")

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "llm_task_routes") and _column_exists(
        inspector, "llm_task_routes", "batch_size"
    ):
        with op.batch_alter_table("llm_task_routes") as batch_op:
            batch_op.drop_column("batch_size")
