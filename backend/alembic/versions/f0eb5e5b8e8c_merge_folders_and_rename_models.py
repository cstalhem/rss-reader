"""merge_folders_and_rename_models

Revision ID: f0eb5e5b8e8c
Revises: 1c3cc7f7d174, 55f0f2e37b8a
Create Date: 2026-03-01 16:22:28.859180

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0eb5e5b8e8c'
down_revision: Union[str, Sequence[str], None] = ('1c3cc7f7d174', '55f0f2e37b8a')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
