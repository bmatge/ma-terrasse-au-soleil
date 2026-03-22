"""Lecture read-only de la BDD de l'app.

Ce module ne fait que des SELECT. Aucune écriture en base.
"""
import os
import sys

import psycopg2
import psycopg2.extras

# Resolve DB URL from environment or app config
def _get_db_url() -> str:
    """Get sync database URL from env or app config."""
    url = os.environ.get("DATABASE_URL_SYNC")
    if url:
        return url

    # Try loading from app config
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
        from app.config import settings
        return settings.DATABASE_URL_SYNC
    except Exception:
        pass

    # Fallback for Docker Compose prod
    return "postgresql://terrasse:devpassword@db:5432/terrasse_soleil"


def get_connection():
    """Open a read-only psycopg2 connection."""
    url = _get_db_url()
    conn = psycopg2.connect(url)
    conn.set_session(readonly=True, autocommit=True)
    return conn


def fetch_terrasses_in_radius(conn, center_lat: float, center_lon: float, radius_m: float) -> list[dict]:
    """Fetch terrasses within radius_m of center point.

    Returns list of dicts with keys: id, nom, adresse, arrondissement, lat, lon.
    """
    query = """
        SELECT
            id,
            COALESCE(nom_commercial, nom) AS nom,
            adresse,
            arrondissement,
            ST_Y(geometry::geometry) AS lat,
            ST_X(geometry::geometry) AS lon
        FROM terrasses
        WHERE ST_DWithin(
            geometry::geography,
            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
            %s
        )
        ORDER BY id
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query, (center_lon, center_lat, radius_m))
        return [dict(row) for row in cur.fetchall()]


def fetch_horizon_profile(conn, terrasse_id: int) -> list[float] | None:
    """Fetch the precomputed 360-element horizon profile for a terrasse.

    Returns None if no profile exists.
    """
    query = "SELECT profile FROM horizon_profiles WHERE terrasse_id = %s"
    with conn.cursor() as cur:
        cur.execute(query, (terrasse_id,))
        row = cur.fetchone()
        if row is None:
            return None
        return list(row[0])
