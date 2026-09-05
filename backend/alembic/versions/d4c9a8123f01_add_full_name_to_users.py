"""add_full_name_to_users

Revision ID: d4c9a8123f01
Revises: b3e8f1a2045c
Create Date: 2026-09-04 22:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "d4c9a8123f01"
down_revision: Union[str, None] = "b3e8f1a2045c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {col["name"] for col in inspect(bind).get_columns("users")}
    if "full_name" not in columns:
        op.add_column("users", sa.Column("full_name", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "full_name")
