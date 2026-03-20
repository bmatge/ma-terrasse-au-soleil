"""Widen phone column to accommodate OSM phone formats

Revision ID: 006
Revises: 005
Create Date: 2026-03-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("terrasses", "phone", type_=sa.String(100))


def downgrade() -> None:
    op.alter_column("terrasses", "phone", type_=sa.String(30))
