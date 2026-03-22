"""Widen typologie column and add categorie column

Revision ID: 007
Revises: 006
Create Date: 2026-03-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("terrasses", "typologie", type_=sa.String(200))
    op.add_column("terrasses", sa.Column("categorie", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("terrasses", "categorie")
    op.alter_column("terrasses", "typologie", type_=sa.String(50))
