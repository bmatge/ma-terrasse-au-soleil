#!/usr/bin/env python3
"""Backfill nom_commercial for terrasses that already have a google_place_id.

Uses the Google Places API Place Details endpoint to fetch displayName
for terrasses that were enriched before nom_commercial was added.

Usage:
    python -m data.backfill_nom_commercial [--limit 500] [--delay 0.1]
"""
import argparse
import asyncio
import logging
import time

import httpx
from sqlalchemy import create_engine, text

from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"


async def fetch_display_name(place_id: str) -> str | None:
    """Fetch displayName for a Google Place ID."""
    headers = {
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": "displayName",
    }
    url = PLACE_DETAILS_URL.format(place_id=place_id)
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            logger.warning("API error %d for %s", resp.status_code, place_id)
            return None
        data = resp.json()
    return data.get("displayName", {}).get("text")


async def main(limit: int, delay: float) -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT id, nom, google_place_id
                FROM terrasses
                WHERE google_place_id IS NOT NULL
                  AND nom_commercial IS NULL
                ORDER BY id
                LIMIT :limit
            """),
            {"limit": limit},
        ).fetchall()

    logger.info("Found %d terrasses to backfill", len(rows))

    updated = 0
    for i, row in enumerate(rows, 1):
        try:
            name = await fetch_display_name(row.google_place_id)
            if name:
                with engine.connect() as conn:
                    conn.execute(
                        text("UPDATE terrasses SET nom_commercial = :name WHERE id = :id"),
                        {"name": name, "id": row.id},
                    )
                    conn.commit()
                updated += 1
                logger.info("[%d/%d] %s -> %s", i, len(rows), row.nom, name)
            else:
                logger.info("[%d/%d] %s -> no displayName", i, len(rows), row.nom)
        except Exception as e:
            logger.warning("[%d/%d] %s -> error: %s", i, len(rows), row.nom, e)

        time.sleep(delay)

    logger.info("Done. %d/%d backfilled.", updated, len(rows))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill nom_commercial from Google Place Details")
    parser.add_argument("--limit", type=int, default=500, help="Max terrasses to process")
    parser.add_argument("--delay", type=float, default=0.1, help="Delay between API calls (seconds)")
    args = parser.parse_args()

    asyncio.run(main(args.limit, args.delay))
