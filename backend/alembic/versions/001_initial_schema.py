"""Initial schema: batiments, terrasses, horizon_profiles, meteo_cache

Revision ID: 001
Revises: None
Create Date: 2026-02-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Batiments (BD TOPO buildings)
    op.create_table(
        "batiments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("geometry", sa.text("geometry(Polygon, 4326)"), nullable=False),
        sa.Column("hauteur", sa.Float, nullable=False),
        sa.Column("altitude_sol", sa.Float, nullable=True),
    )
    op.create_index("idx_batiments_geometry", "batiments", ["geometry"], postgresql_using="gist")

    # Terrasses (Paris Open Data)
    op.create_table(
        "terrasses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nom", sa.String, nullable=False),
        sa.Column("adresse", sa.String, nullable=True),
        sa.Column("arrondissement", sa.String(5), nullable=True),
        sa.Column("geometry", sa.text("geometry(Point, 4326)"), nullable=False),
        sa.Column("typologie", sa.String(50), nullable=True),
        sa.Column("siret", sa.String(20), nullable=True),
        sa.Column("longueur", sa.Float, nullable=True),
        sa.Column("largeur", sa.Float, nullable=True),
        sa.Column("source", sa.String(30), server_default="paris_opendata"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("idx_terrasses_geometry", "terrasses", ["geometry"], postgresql_using="gist")
    op.execute(
        "CREATE INDEX idx_terrasses_nom_trgm ON terrasses USING GIN (nom gin_trgm_ops)"
    )

    # Horizon profiles (precomputed per terrace)
    op.create_table(
        "horizon_profiles",
        sa.Column(
            "terrasse_id",
            sa.Integer,
            sa.ForeignKey("terrasses.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("profile", sa.ARRAY(sa.Float, dimensions=1), nullable=False),
        sa.Column("computed_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Meteo cache
    op.create_table(
        "meteo_cache",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("lat_grid", sa.Float, nullable=False),
        sa.Column("lon_grid", sa.Float, nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("hourly_data", JSONB, nullable=False),
        sa.Column("fetched_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("lat_grid", "lon_grid", "date", name="uq_meteo_cache_location_date"),
    )
    op.create_index("idx_meteo_cache_lookup", "meteo_cache", ["lat_grid", "lon_grid", "date"])


def downgrade() -> None:
    op.drop_table("meteo_cache")
    op.drop_table("horizon_profiles")
    op.drop_table("terrasses")
    op.drop_table("batiments")
