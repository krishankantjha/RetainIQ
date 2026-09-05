"""add user_id to uploads

Revision ID: f9c2a1b8043d
Revises: e8b2c4f91a03
Create Date: 2026-09-05 18:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f9c2a1b8043d"
down_revision: Union[str, None] = "e8b2c4f91a03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("uploads") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_uploads_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_uploads_user_id", ["user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("uploads") as batch_op:
        batch_op.drop_index("ix_uploads_user_id")
        batch_op.drop_constraint("fk_uploads_user_id_users", type_="foreignkey")
        batch_op.drop_column("user_id")
