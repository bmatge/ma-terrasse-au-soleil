"""Validate imported data: counts, spatial extent, basic sanity checks.

Usage:
    python data/validate_data.py
"""
import os

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://terrasse:devpassword@localhost:5432/terrasse_soleil",
)


def validate() -> None:
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # Batiments
        count = conn.execute(text("SELECT COUNT(*) FROM batiments")).scalar()
        print(f"Batiments: {count} rows")

        if count > 0:
            stats = conn.execute(text("""
                SELECT
                    MIN(hauteur) AS h_min,
                    AVG(hauteur)::numeric(6,1) AS h_avg,
                    MAX(hauteur) AS h_max,
                    ST_Extent(geometry) AS bbox
                FROM batiments
            """)).fetchone()
            print(f"  Hauteur: min={stats[0]}m, avg={stats[1]}m, max={stats[2]}m")
            print(f"  Bounding box: {stats[3]}")

        # Terrasses
        count = conn.execute(text("SELECT COUNT(*) FROM terrasses")).scalar()
        print(f"\nTerrasses: {count} rows")

        if count > 0:
            stats = conn.execute(text("""
                SELECT
                    COUNT(DISTINCT arrondissement) AS arr_count,
                    ST_Extent(geometry) AS bbox
                FROM terrasses
            """)).fetchone()
            print(f"  Arrondissements: {stats[0]}")
            print(f"  Bounding box: {stats[1]}")

            # Top 5 arrondissements
            rows = conn.execute(text("""
                SELECT arrondissement, COUNT(*) AS n
                FROM terrasses
                GROUP BY arrondissement
                ORDER BY n DESC
                LIMIT 5
            """)).fetchall()
            print("  Top arrondissements:")
            for row in rows:
                print(f"    {row[0]}: {row[1]} terrasses")

        # Horizon profiles
        count = conn.execute(text("SELECT COUNT(*) FROM horizon_profiles")).scalar()
        print(f"\nHorizon profiles: {count} rows")

        # Meteo cache
        count = conn.execute(text("SELECT COUNT(*) FROM meteo_cache")).scalar()
        print(f"Meteo cache: {count} rows")


if __name__ == "__main__":
    validate()
