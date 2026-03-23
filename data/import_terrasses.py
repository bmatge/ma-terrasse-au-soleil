"""Import Paris Open Data terrasses into PostGIS.

Reads the GeoJSON export of 'terrasses-autorisations', filters to open terraces only,
and inserts into the 'terrasses' table.

Usage:
    python data/import_terrasses.py [path_to_geojson]
"""
import json
import os
import sys
import time

from sqlalchemy import create_engine, text

from data.classify import classify_typologie, EXCLUDED_CATEGORIES

DATABASE_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://terrasse:devpassword@localhost:5432/terrasse_soleil",
)

RAW_DIR = os.path.join(os.path.dirname(__file__), "raw")
DEFAULT_FILE = os.path.join(RAW_DIR, "terrasses_paris.geojson")


def import_terrasses(geojson_path: str) -> None:
    engine = create_engine(DATABASE_URL)

    print(f"Reading {geojson_path}...")
    with open(geojson_path) as f:
        data = json.load(f)

    features = data["features"]
    print(f"  Total features: {len(features)}")

    # Deduplicate by siret + adresse + typologie
    # (one establishment can have multiple terrasse types: OUVERTE, ÉTALAGE, etc.)
    seen = set()
    unique_features = []
    for f in features:
        props = f["properties"]
        key = (props.get("siret", ""), props.get("adresse", ""), props.get("typologie", ""))
        if key not in seen:
            seen.add(key)
            unique_features.append(f)
    features = unique_features
    print(f"  After dedup (siret+adresse+typologie): {len(features)}")

    # Filter out non-terrasse types (étalages, commerces accessoires, etc.)
    before_filter = len(features)
    features = [
        f for f in features
        if classify_typologie(f["properties"].get("typologie")) not in EXCLUDED_CATEGORIES
    ]
    print(f"  After filtering excluded types: {len(features)} ({before_filter - len(features)} excluded)")

    # Build insert values
    print("Inserting into PostGIS...")
    t0 = time.time()

    insert_sql = text("""
        INSERT INTO terrasses (nom, adresse, arrondissement, geometry, typologie, categorie, siret, longueur, largeur, source)
        VALUES (
            :nom,
            :adresse,
            :arrondissement,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
            :typologie,
            :categorie,
            :siret,
            :longueur,
            :largeur,
            'paris_opendata'
        )
    """)

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE terrasses RESTART IDENTITY CASCADE"))

        batch = []
        for f in features:
            props = f["properties"]
            geom = f["geometry"]

            if geom is None or geom.get("coordinates") is None:
                continue

            coords = geom["coordinates"]
            # GeoJSON can have Point or nested coords
            if geom["type"] == "Point":
                lon, lat = coords[0], coords[1]
            else:
                continue

            typologie_raw = props.get("typologie")
            batch.append({
                "nom": props.get("nom_enseigne") or props.get("adresse") or "Inconnu",
                "adresse": props.get("adresse"),
                "arrondissement": props.get("arrondissement"),
                "lon": lon,
                "lat": lat,
                "typologie": typologie_raw,
                "categorie": classify_typologie(typologie_raw),
                "siret": props.get("siret"),
                "longueur": props.get("longueur"),
                "largeur": props.get("largeur"),
            })

        if batch:
            conn.execute(insert_sql, batch)

    print(f"  Imported {len(batch)} terrasses in {time.time() - t0:.1f}s")

    # Verify
    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM terrasses")).scalar()
        print(f"  Verified: {count} rows in terrasses table")


if __name__ == "__main__":
    geojson_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FILE
    import_terrasses(geojson_path)
