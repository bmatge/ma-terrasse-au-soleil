"""Add place_type, rating, user_rating_count, phone, website, google_maps_uri to terrasses

Revision ID: 003
Revises: 002
Create Date: 2026-03-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("terrasses", sa.Column("place_type", sa.String(50), nullable=True))
    op.add_column("terrasses", sa.Column("rating", sa.Float(), nullable=True))
    op.add_column("terrasses", sa.Column("user_rating_count", sa.Integer(), nullable=True))
    op.add_column("terrasses", sa.Column("phone", sa.String(30), nullable=True))
    op.add_column("terrasses", sa.Column("website", sa.String(500), nullable=True))
    op.add_column("terrasses", sa.Column("google_maps_uri", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("terrasses", "google_maps_uri")
    op.drop_column("terrasses", "website")
    op.drop_column("terrasses", "phone")
    op.drop_column("terrasses", "user_rating_count")
    op.drop_column("terrasses", "rating")
    op.drop_column("terrasses", "place_type")
