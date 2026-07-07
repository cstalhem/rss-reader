"""add mark_read_dwell_seconds to user_preferences

Revision ID: b60d6250cb10
Revises: d232d838dd4b
Create Date: 2026-07-07 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b60d6250cb10"
down_revision: str | Sequence[str] | None = "d232d838dd4b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default="5" populates the existing single row; the ORM default
    # (Field(default=5)) covers rows inserted from Python.
    with op.batch_alter_table("user_preferences", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "mark_read_dwell_seconds",
                sa.Integer(),
                nullable=False,
                server_default="5",
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("user_preferences", schema=None) as batch_op:
        batch_op.drop_column("mark_read_dwell_seconds")
