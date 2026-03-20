#!/usr/bin/env python3
"""Enrich terrasses with OpenStreetMap + Recherche Entreprises (SIRENE) data.

Replaces Google Places API for new enrichments. Existing Google data is preserved
and merged: SIRENE > OSM > Google for nom_commercial priority.

Also imports bars/pubs from OSM that have no declared terrasse in the Paris dataset,
inserting them with source='osm'.

Usage:
    python -m data.enrich_osm_sirene [--force] [--skip-osm-import] [--limit N]
"""
import argparse
import asyncio
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import create_engine, text

from app.config import settings
from app.services.osm import download_osm_pois, match_terrasse_to_osm, OsmPoi
from app.services.sirene import batch_fetch_sirene

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def enrich_from_osm(engine, pois: list[OsmPoi], force: bool = False) -> int:
    """Match terrasses to OSM POIs and update enrichment fields.

    Returns count of enriched terrasses.
    """
    where = "TRUE" if force else "osm_id IS NULL"

    with engine.connect() as conn:
        rows = conn.execute(text(f"""
            SELECT id, nom, nom_commercial, adresse, siret,
                   ST_X(geometry) AS lon, ST_Y(geometry) AS lat,
                   phone, website
            FROM terrasses
            WHERE {where}
            ORDER BY id
        """)).fetchall()

    logger.info("OSM enrichment: %d terrasses to process", len(rows))
    updated = 0

    for i, row in enumerate(rows, 1):
        match = match_terrasse_to_osm(
            terrasse_lat=row.lat,
            terrasse_lon=row.lon,
            terrasse_nom=row.nom_commercial or row.nom,
            terrasse_siret=row.siret,
            pois=pois,
        )

        if match is None:
            continue

        # Build update: only fill in missing fields (don't overwrite Google data)
        updates = {"id": row.id, "osm_id": match.osm_id}
        set_clauses = ["osm_id = :osm_id"]

        if match.opening_hours:
            updates["opening_hours"] = match.opening_hours
            set_clauses.append("opening_hours = :opening_hours")

        if match.cuisine:
            updates["cuisine"] = match.cuisine
            set_clauses.append("cuisine = :cuisine")

        if match.outdoor_seating is not None:
            updates["outdoor_seating"] = match.outdoor_seating
            set_clauses.append("outdoor_seating = :outdoor_seating")

        # Phone/website: only if not already set (Google may have better data)
        if match.phone and not row.phone:
            updates["phone"] = match.phone
            set_clauses.append("phone = :phone")

        if match.website and not row.website:
            updates["website"] = match.website
            set_clauses.append("website = :website")

        # nom_commercial from OSM only if not already set
        if match.name and not row.nom_commercial:
            updates["nom_commercial"] = match.name
            set_clauses.append("nom_commercial = :nom_commercial")

        # place_type from OSM amenity
        if match.amenity:
            updates["place_type_osm"] = match.amenity
            set_clauses.append("place_type = COALESCE(place_type, :place_type_osm)")

        # Track enrichment
        updates["enrichment_source"] = "osm"
        updates["enrichment_date"] = datetime.now(timezone.utc)
        set_clauses.append("enrichment_source = CASE WHEN enrichment_source IS NULL THEN 'osm' WHEN enrichment_source NOT LIKE '%osm%' THEN enrichment_source || ',osm' ELSE enrichment_source END")
        set_clauses.append("enrichment_date = :enrichment_date")

        with engine.connect() as conn:
            conn.execute(
                text(f"UPDATE terrasses SET {', '.join(set_clauses)} WHERE id = :id"),
                updates,
            )
            conn.commit()

        updated += 1
        if updated % 100 == 0:
            logger.info("OSM: enriched %d terrasses so far...", updated)

    logger.info("OSM enrichment done: %d/%d terrasses matched", updated, len(rows))
    return updated


async def enrich_from_sirene(engine, force: bool = False, limit: int | None = None) -> int:
    """Enrich terrasses with SIRENE data (enseigne, état, NAF).

    Returns count of enriched terrasses.
    """
    where = "siret IS NOT NULL AND siret != ''"
    if not force:
        where += " AND enseigne_sirene IS NULL"

    query = f"""
        SELECT id, siret
        FROM terrasses
        WHERE {where}
        ORDER BY id
    """
    if limit:
        query += f" LIMIT {limit}"

    with engine.connect() as conn:
        rows = conn.execute(text(query)).fetchall()

    if not rows:
        logger.info("SIRENE: no terrasses to enrich")
        return 0

    sirets = list({row.siret for row in rows})
    logger.info("SIRENE enrichment: %d unique SIRETs to look up", len(sirets))

    # Batch fetch from API
    sirene_data = await batch_fetch_sirene(sirets)

    # Apply to terrasses
    updated = 0
    for row in rows:
        info = sirene_data.get(row.siret)
        if not info:
            continue

        # Best commercial name: enseigne > nom_commercial > raison_sociale
        best_name = info.enseigne or info.nom_commercial

        updates = {"id": row.id}
        set_clauses = []

        if best_name:
            updates["enseigne_sirene"] = best_name
            set_clauses.append("enseigne_sirene = :enseigne_sirene")
            # Set nom_commercial if not already set (SIRENE has priority)
            set_clauses.append("nom_commercial = COALESCE(nom_commercial, :enseigne_sirene)")

        if info.etat_administratif:
            updates["etat_administratif"] = info.etat_administratif
            set_clauses.append("etat_administratif = :etat_administratif")

        if info.code_naf:
            updates["code_naf"] = info.code_naf
            set_clauses.append("code_naf = :code_naf")

        if not set_clauses:
            continue

        # Track enrichment
        updates["enrichment_date"] = datetime.now(timezone.utc)
        set_clauses.append("enrichment_source = CASE WHEN enrichment_source IS NULL THEN 'sirene' WHEN enrichment_source NOT LIKE '%sirene%' THEN enrichment_source || ',sirene' ELSE enrichment_source END")
        set_clauses.append("enrichment_date = :enrichment_date")

        with engine.connect() as conn:
            conn.execute(
                text(f"UPDATE terrasses SET {', '.join(set_clauses)} WHERE id = :id"),
                updates,
            )
            conn.commit()

        updated += 1

    logger.info("SIRENE enrichment done: %d terrasses updated", updated)
    return updated


async def import_osm_bars(engine, pois: list[OsmPoi]) -> int:
    """Import bars/pubs from OSM that don't have a declared terrasse.

    These are venues with outdoor_seating=yes in OSM but not in the Paris terrasses dataset.
    Inserted with source='osm'.
    """
    # Get all existing osm_ids and approximate coordinates
    with engine.connect() as conn:
        existing_osm_ids = {
            row[0] for row in
            conn.execute(text("SELECT osm_id FROM terrasses WHERE osm_id IS NOT NULL")).fetchall()
        }
        existing_coords = conn.execute(text("""
            SELECT ST_X(geometry) AS lon, ST_Y(geometry) AS lat
            FROM terrasses
        """)).fetchall()

    existing_points = [(row.lon, row.lat) for row in existing_coords]

    from app.services.osm import _haversine_m

    # Build name set for dedup by name+proximity
    existing_names = {}
    with engine.connect() as conn:
        name_rows = conn.execute(text("""
            SELECT nom_commercial, ST_X(geometry) AS lon, ST_Y(geometry) AS lat
            FROM terrasses WHERE nom_commercial IS NOT NULL
        """)).fetchall()
    for row in name_rows:
        existing_names.setdefault(row.nom_commercial.lower(), []).append((row.lon, row.lat))

    # Filter: OSM POIs not already matched AND not a duplicate of existing terrasse
    new_pois = []
    for poi in pois:
        if poi.osm_id in existing_osm_ids:
            continue
        # Only import if outdoor_seating is confirmed or amenity is bar/pub
        if poi.outdoor_seating is not True and poi.amenity not in ("bar", "pub"):
            continue
        # Check not a duplicate: same name within 5m = same place
        is_duplicate = False
        if poi.name:
            same_name_locations = existing_names.get(poi.name.lower(), [])
            for elon, elat in same_name_locations:
                if _haversine_m(poi.lat, poi.lon, elat, elon) < 5:
                    is_duplicate = True
                    break
        # No name match: check pure proximity (<5m = almost certainly same place)
        if not is_duplicate:
            for elon, elat in existing_points:
                if _haversine_m(poi.lat, poi.lon, elat, elon) < 5:
                    is_duplicate = True
                    break
        if is_duplicate:
            continue
        new_pois.append(poi)

    if not new_pois:
        logger.info("OSM import: no new bars/pubs to import")
        return 0

    logger.info("OSM import: inserting %d new bars/pubs from OSM", len(new_pois))

    insert_sql = text("""
        INSERT INTO terrasses (nom, adresse, geometry, source, osm_id,
                               opening_hours, cuisine, outdoor_seating, place_type,
                               phone, website, nom_commercial, siret,
                               enrichment_source, enrichment_date)
        VALUES (
            :nom,
            :adresse,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
            'osm',
            :osm_id,
            :opening_hours,
            :cuisine,
            :outdoor_seating,
            :place_type,
            :phone,
            :website,
            :nom_commercial,
            :siret,
            'osm',
            :enrichment_date
        )
    """)

    now = datetime.now(timezone.utc)
    batch = []
    for poi in new_pois:
        addr_parts = []
        if poi.addr_housenumber:
            addr_parts.append(poi.addr_housenumber)
        if poi.addr_street:
            addr_parts.append(poi.addr_street)
        if poi.addr_postcode:
            addr_parts.append(poi.addr_postcode)

        batch.append({
            "nom": poi.name or "Sans nom",
            "adresse": " ".join(addr_parts) if addr_parts else None,
            "lon": poi.lon,
            "lat": poi.lat,
            "osm_id": poi.osm_id,
            "opening_hours": poi.opening_hours,
            "cuisine": poi.cuisine,
            "outdoor_seating": poi.outdoor_seating,
            "place_type": poi.amenity,
            "phone": (poi.phone or "")[:100] or None,
            "website": poi.website,
            "nom_commercial": poi.name,
            "siret": poi.siret,
            "enrichment_date": now,
        })

    with engine.begin() as conn:
        conn.execute(insert_sql, batch)

    logger.info("OSM import: inserted %d new POIs", len(batch))
    return len(batch)


async def main(force: bool = False, skip_osm_import: bool = False, limit: int | None = None) -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)
    t0 = time.time()

    # Step 1: Download OSM data
    logger.info("=== Step 1: Download OSM POIs ===")
    pois = await download_osm_pois(force=force)
    logger.info("Got %d OSM POIs in Paris", len(pois))

    # Step 2: Enrich existing terrasses from OSM
    logger.info("=== Step 2: Enrich terrasses from OSM ===")
    osm_count = await enrich_from_osm(engine, pois, force=force)

    # Step 3: Enrich from SIRENE
    logger.info("=== Step 3: Enrich terrasses from SIRENE ===")
    sirene_count = await enrich_from_sirene(engine, force=force, limit=limit)

    # Step 4: Import new bars/pubs from OSM
    osm_import_count = 0
    if not skip_osm_import:
        logger.info("=== Step 4: Import OSM bars without declared terrasse ===")
        osm_import_count = await import_osm_bars(engine, pois)

    elapsed = time.time() - t0
    logger.info(
        "=== Done in %.1fs === OSM matched: %d | SIRENE enriched: %d | OSM imported: %d",
        elapsed, osm_count, sirene_count, osm_import_count,
    )

    engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich terrasses with OSM + SIRENE data")
    parser.add_argument("--force", action="store_true", help="Re-enrich all, even already enriched")
    parser.add_argument("--skip-osm-import", action="store_true", help="Skip importing new bars from OSM")
    parser.add_argument("--limit", type=int, default=None, help="Limit SIRENE API calls")
    args = parser.parse_args()

    asyncio.run(main(force=args.force, skip_osm_import=args.skip_osm_import, limit=args.limit))
