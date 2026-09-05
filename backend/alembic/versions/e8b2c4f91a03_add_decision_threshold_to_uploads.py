"""add decision_threshold to uploads

Revision ID: e8b2c4f91a03
Revises: d4c9a8123f01
Create Date: 2026-09-04 23:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e8b2c4f91a03"
down_revision: Union[str, None] = "d4c9a8123f01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("uploads", sa.Column("decision_threshold", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("uploads", "decision_threshold")
