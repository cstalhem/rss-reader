"""add_content_markdown_to_articles

Revision ID: 154075cd3c1a
Revises: f0eb5e5b8e8c
Create Date: 2026-03-10 16:31:10.148694

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "154075cd3c1a"
down_revision: str | Sequence[str] | None = "f0eb5e5b8e8c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    columns = inspector.get_columns(table_name)
    return any(column["name"] == column_name for column in columns)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _column_exists(inspector, "articles", "content_markdown"):
        with op.batch_alter_table("articles", schema=None) as batch_op:
            batch_op.add_column(sa.Column("content_markdown", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _column_exists(inspector, "articles", "content_markdown"):
        with op.batch_alter_table("articles", schema=None) as batch_op:
            batch_op.drop_column("content_markdown")
