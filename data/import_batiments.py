"""Import BD TOPO buildings (D075 Paris) into PostGIS.

Reads the GeoPackage 'batiment' layer, reprojects from Lambert-93 (EPSG:2154)
to WGS84 (EPSG:4326), and bulk-inserts into the 'batiments' table.

Usage:
    python data/import_batiments.py [path_to_gpkg]
"""
import glob
import os
import sys
import time

import geopandas as gpd
import shapely
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://terrasse:devpassword@localhost:5432/terrasse_soleil",
)

RAW_DIR = os.path.join(os.path.dirname(__file__), "raw")


def find_gpkg() -> str:
    """Find the BD TOPO GeoPackage file in data/raw/."""
    matches = glob.glob(os.path.join(RAW_DIR, "**", "*.gpkg"), recursive=True)
    if not matches:
        print("ERROR: No .gpkg file found in data/raw/")
        print("Run: bash data/download_bdtopo.sh")
        sys.exit(1)
    print(f"Found GeoPackage: {matches[0]}")
    return matches[0]


def import_batiments(gpkg_path: str) -> None:
    engine = create_engine(DATABASE_URL)

    print("Reading BD TOPO 'batiment' layer...")
    t0 = time.time()
    gdf = gpd.read_file(gpkg_path, layer="batiment")
    print(f"  Read {len(gdf)} buildings in {time.time() - t0:.1f}s")

    # Keep only buildings with a valid height
    gdf = gdf[gdf["hauteur"].notna() & (gdf["hauteur"] > 0)]
    print(f"  After height filter: {len(gdf)} buildings")

    # Select and rename columns
    gdf = gdf.rename(columns={
        "altitude_minimale_sol": "altitude_sol",
    })
    gdf = gdf[["geometry", "hauteur", "altitude_sol"]]

    # Reproject from Lambert-93 to WGS84
    print("Reprojecting EPSG:2154 → EPSG:4326...")
    gdf = gdf.to_crs(epsg=4326)

    # Drop Z dimension (BD TOPO has 3D geometries, table expects 2D)
    print("Dropping Z dimension...")
    gdf["geometry"] = shapely.force_2d(gdf["geometry"])

    # Convert MultiPolygon to Polygon (explode multi-part geometries)
    multi_count = (gdf.geometry.geom_type == "MultiPolygon").sum()
    if multi_count > 0:
        print(f"  Exploding {multi_count} MultiPolygons...")
        gdf = gdf.explode(index_parts=False)

    # Clear existing data and insert
    print(f"Writing {len(gdf)} buildings to PostGIS...")
    t0 = time.time()

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE batiments RESTART IDENTITY CASCADE"))

    gdf.to_postgis("batiments", engine, if_exists="append", index=False)
    print(f"  Imported in {time.time() - t0:.1f}s")

    # Verify
    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM batiments")).scalar()
        print(f"  Verified: {count} rows in batiments table")


if __name__ == "__main__":
    gpkg_path = sys.argv[1] if len(sys.argv) > 1 else find_gpkg()
    import_batiments(gpkg_path)
