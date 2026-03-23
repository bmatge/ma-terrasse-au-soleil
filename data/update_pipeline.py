#!/usr/bin/env python3
"""Periodic update pipeline: sync terrasses, enrich, compute horizons.

Run this periodically (weekly/monthly) to keep the database up to date.

Steps:
  1. Download fresh terrasses GeoJSON from Paris Open Data
  2. Sync terrasses: UPSERT new ones, flag removed ones
  3. Download OSM POIs (bars/cafes/restaurants in Paris)
  4. Enrich from OSM (match by SIRET then proximity)
  5. Enrich from SIRENE (commercial names via API)
  6. Import new bars/pubs from OSM without declared terrasse
  7. Compute horizon profiles for new terrasses

Usage:
    python -m data.update_pipeline [--skip-download] [--skip-horizons] [--force]
"""
import argparse
import asyncio
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, text

from app.config import settings
from data.classify import classify_typologie, EXCLUDED_CATEGORIES
from app.services.osm import download_osm_pois
from data.enrich_osm_sirene import enrich_from_osm, enrich_from_sirene, import_osm_bars

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent
RAW_DIR = DATA_DIR / "raw"
GEOJSON_FILE = RAW_DIR / "terrasses_paris.geojson"


def step_download_terrasses() -> int:
    """Download fresh terrasses GeoJSON. Returns feature count."""
    logger.info("=== Step 1: Downloading terrasses from Paris Open Data ===")
    result = subprocess.run(
        ["bash", str(DATA_DIR / "download_terrasses.sh")],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        logger.error("Download failed: %s", result.stderr)
        raise RuntimeError("Failed to download terrasses")

    with open(GEOJSON_FILE) as f:
        data = json.load(f)
    count = len(data["features"])
    logger.info("Downloaded %d terrasses", count)
    return count


def step_sync_terrasses(engine) -> dict:
    """UPSERT terrasses from GeoJSON: add new, update existing, flag removed.

    Returns stats dict with counts.
    """
    logger.info("=== Step 2: Syncing terrasses to database ===")

    with open(GEOJSON_FILE) as f:
        data = json.load(f)

    features = data["features"]

    # Filter out features without valid Point geometry before dedup
    features = [
        f for f in features
        if f.get("geometry") and f["geometry"].get("coordinates") and f["geometry"]["type"] == "Point"
    ]

    # Deduplicate by siret + adresse + typologie
    # (one establishment can have multiple terrasse types: OUVERTE, ÉTALAGE, etc.)
    seen = set()
    unique = []
    for f in features:
        props = f["properties"]
        key = (props.get("siret", ""), props.get("adresse", ""), props.get("typologie", ""))
        if key not in seen:
            seen.add(key)
            unique.append(f)
    features = unique

    # Filter out non-terrasse types (étalages, commerces accessoires, etc.)
    before_filter = len(features)
    features = [
        f for f in features
        if classify_typologie(f["properties"].get("typologie")) not in EXCLUDED_CATEGORIES
    ]
    logger.info("GeoJSON: %d unique terrasse features (%d excluded)", len(features), before_filter - len(features))

    # Get existing terrasses (only paris_opendata source)
    with engine.connect() as conn:
        existing = conn.execute(text("""
            SELECT id, siret, adresse, typologie FROM terrasses WHERE source = 'paris_opendata'
        """)).fetchall()

    existing_keys = {(row.siret or "", row.adresse or "", row.typologie or ""): row.id for row in existing}
    new_keys = set()

    inserted = 0
    updated = 0

    upsert_sql = text("""
        INSERT INTO terrasses (nom, adresse, arrondissement, geometry, typologie, categorie,
                               siret, longueur, largeur, source)
        VALUES (:nom, :adresse, :arrondissement,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                :typologie, :categorie, :siret, :longueur, :largeur, 'paris_opendata')
        ON CONFLICT DO NOTHING
    """)

    with engine.begin() as conn:
        for f in features:
            props = f["properties"]
            geom = f["geometry"]
            lon, lat = geom["coordinates"][0], geom["coordinates"][1]
            typologie_raw = props.get("typologie")
            categorie = classify_typologie(typologie_raw)
            key = (props.get("siret", ""), props.get("adresse", ""), typologie_raw or "")
            new_keys.add(key)

            if key in existing_keys:
                # Already exists — only update if mutable fields changed
                result = conn.execute(text("""
                    UPDATE terrasses
                    SET nom = :nom, longueur = :longueur, largeur = :largeur,
                        arrondissement = :arrondissement, typologie = :typologie,
                        categorie = :categorie
                    WHERE id = :id
                      AND (nom IS DISTINCT FROM :nom
                           OR longueur IS DISTINCT FROM :longueur
                           OR largeur IS DISTINCT FROM :largeur
                           OR arrondissement IS DISTINCT FROM :arrondissement
                           OR typologie IS DISTINCT FROM :typologie
                           OR categorie IS DISTINCT FROM :categorie)
                """), {
                    "id": existing_keys[key],
                    "nom": props.get("nom_enseigne") or props.get("adresse") or "Inconnu",
                    "longueur": props.get("longueur"),
                    "largeur": props.get("largeur"),
                    "arrondissement": props.get("arrondissement"),
                    "typologie": typologie_raw,
                    "categorie": categorie,
                })
                if result.rowcount > 0:
                    updated += 1
            else:
                conn.execute(upsert_sql, {
                    "nom": props.get("nom_enseigne") or props.get("adresse") or "Inconnu",
                    "adresse": props.get("adresse"),
                    "arrondissement": props.get("arrondissement"),
                    "lon": lon,
                    "lat": lat,
                    "typologie": typologie_raw,
                    "categorie": categorie,
                    "siret": props.get("siret"),
                    "longueur": props.get("longueur"),
                    "largeur": props.get("largeur"),
                })
                inserted += 1

    # Flag removed terrasses (in DB but not in new data)
    removed_keys = set(existing_keys.keys()) - new_keys
    removed = 0
    if removed_keys:
        removed_ids = [existing_keys[k] for k in removed_keys]
        with engine.begin() as conn:
            conn.execute(
                text("UPDATE terrasses SET etat_administratif = 'F' WHERE id = ANY(:ids)"),
                {"ids": removed_ids},
            )
        removed = len(removed_ids)

    stats = {"inserted": inserted, "updated": updated, "removed": removed}
    logger.info("Sync done: +%d new, ~%d updated, -%d removed", inserted, updated, removed)
    return stats


def step_compute_horizons():
    """Run horizon profile computation for new terrasses."""
    logger.info("=== Step 7: Computing horizon profiles for new terrasses ===")
    result = subprocess.run(
        [sys.executable, str(DATA_DIR / "compute_horizon_profiles.py")],
        capture_output=True, text=True,
        cwd=str(DATA_DIR.parent),
    )
    logger.info(result.stdout)
    if result.returncode != 0:
        logger.warning("Horizon computation had issues: %s", result.stderr)


async def run_pipeline(
    skip_download: bool = False,
    skip_horizons: bool = False,
    force: bool = False,
) -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)
    t0 = time.time()
    errors: list[str] = []
    sync_stats = {"inserted": 0, "updated": 0, "removed": 0}
    osm_count = 0
    sirene_count = 0
    osm_import = 0
    pois = []

    # Step 1: Download
    try:
        if not skip_download:
            step_download_terrasses()
        else:
            logger.info("Skipping download (--skip-download)")
    except Exception as e:
        logger.error("Step 1 (download) failed: %s", e)
        errors.append(f"Step 1 download: {e}")

    # Step 2: Sync terrasses
    try:
        sync_stats = step_sync_terrasses(engine)
    except Exception as e:
        logger.error("Step 2 (sync) failed: %s", e)
        errors.append(f"Step 2 sync: {e}")

    # Step 3: Download OSM
    try:
        logger.info("=== Step 3: Download OSM POIs ===")
        pois = await download_osm_pois(force=force)
    except Exception as e:
        logger.error("Step 3 (OSM download) failed: %s", e)
        errors.append(f"Step 3 OSM download: {e}")

    # Step 4: Enrich from OSM
    try:
        if pois:
            logger.info("=== Step 4: Enrich from OSM ===")
            osm_count = await enrich_from_osm(engine, pois, force=force)
        else:
            logger.info("Skipping step 4 (no OSM data)")
    except Exception as e:
        logger.error("Step 4 (OSM enrich) failed: %s", e)
        errors.append(f"Step 4 OSM enrich: {e}")

    # Step 5: Enrich from SIRENE
    try:
        logger.info("=== Step 5: Enrich from SIRENE ===")
        sirene_count = await enrich_from_sirene(engine, force=force)
    except Exception as e:
        logger.error("Step 5 (SIRENE) failed: %s", e)
        errors.append(f"Step 5 SIRENE: {e}")

    # Step 6: Import new bars from OSM
    try:
        if pois:
            logger.info("=== Step 6: Import OSM bars without declared terrasse ===")
            osm_import = await import_osm_bars(engine, pois)
        else:
            logger.info("Skipping step 6 (no OSM data)")
    except Exception as e:
        logger.error("Step 6 (OSM import) failed: %s", e)
        errors.append(f"Step 6 OSM import: {e}")

    # Step 6b: Enrich newly imported bars with SIRENE
    try:
        if osm_import > 0:
            logger.info("=== Step 6b: Enrich new OSM bars with SIRENE ===")
            sirene_count_2 = await enrich_from_sirene(engine)
            sirene_count += sirene_count_2
    except Exception as e:
        logger.error("Step 6b (SIRENE for new bars) failed: %s", e)
        errors.append(f"Step 6b SIRENE new bars: {e}")

    # Step 7: Compute horizons
    try:
        if not skip_horizons:
            step_compute_horizons()
        else:
            logger.info("Skipping horizon computation (--skip-horizons)")
    except Exception as e:
        logger.error("Step 7 (horizons) failed: %s", e)
        errors.append(f"Step 7 horizons: {e}")

    elapsed = time.time() - t0

    logger.info("=" * 60)
    if errors:
        logger.warning("UPDATE PIPELINE COMPLETE WITH %d ERROR(S) in %.1fs", len(errors), elapsed)
        for err in errors:
            logger.warning("  ✗ %s", err)
    else:
        logger.info("UPDATE PIPELINE COMPLETE in %.1fs", elapsed)
    logger.info("  Terrasses: +%d new, ~%d updated, -%d removed",
                sync_stats["inserted"], sync_stats["updated"], sync_stats["removed"])
    logger.info("  OSM enriched: %d | SIRENE enriched: %d | OSM imported: %d",
                osm_count, sirene_count, osm_import)
    logger.info("=" * 60)

    engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Periodic terrasses update pipeline")
    parser.add_argument("--skip-download", action="store_true",
                        help="Skip re-downloading terrasses GeoJSON")
    parser.add_argument("--skip-horizons", action="store_true",
                        help="Skip horizon profile computation")
    parser.add_argument("--force", action="store_true",
                        help="Force re-enrichment of all terrasses")
    args = parser.parse_args()

    asyncio.run(run_pipeline(
        skip_download=args.skip_download,
        skip_horizons=args.skip_horizons,
        force=args.force,
    ))
