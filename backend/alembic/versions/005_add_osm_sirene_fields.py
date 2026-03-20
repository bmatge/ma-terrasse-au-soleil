"""Add OSM and SIRENE enrichment fields to terrasses

Revision ID: 005
Revises: 004
Create Date: 2026-03-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # OSM fields
    op.add_column("terrasses", sa.Column("osm_id", sa.BigInteger(), nullable=True))
    op.add_column("terrasses", sa.Column("opening_hours", sa.Text(), nullable=True))
    op.add_column("terrasses", sa.Column("cuisine", sa.Text(), nullable=True))
    op.add_column("terrasses", sa.Column("outdoor_seating", sa.Boolean(), nullable=True))

    # SIRENE fields
    op.add_column("terrasses", sa.Column("enseigne_sirene", sa.String(300), nullable=True))
    op.add_column("terrasses", sa.Column("etat_administratif", sa.String(2), nullable=True))
    op.add_column("terrasses", sa.Column("code_naf", sa.String(10), nullable=True))

    # Enrichment tracking
    op.add_column("terrasses", sa.Column("enrichment_source", sa.String(50), nullable=True))
    op.add_column("terrasses", sa.Column("enrichment_date", sa.DateTime(), nullable=True))

    # Index on osm_id for dedup
    op.create_index("ix_terrasses_osm_id", "terrasses", ["osm_id"], unique=False)
    # Index on siret for SIRENE lookups
    op.create_index("ix_terrasses_siret", "terrasses", ["siret"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_terrasses_siret", table_name="terrasses")
    op.drop_index("ix_terrasses_osm_id", table_name="terrasses")
    op.drop_column("terrasses", "enrichment_date")
    op.drop_column("terrasses", "enrichment_source")
    op.drop_column("terrasses", "code_naf")
    op.drop_column("terrasses", "etat_administratif")
    op.drop_column("terrasses", "enseigne_sirene")
    op.drop_column("terrasses", "outdoor_seating")
    op.drop_column("terrasses", "cuisine")
    op.drop_column("terrasses", "opening_hours")
    op.drop_column("terrasses", "osm_id")
