#!/usr/bin/env python3
"""Batch-enrich terrasses with Google Places price_level.

Uses Nearby Search on each terrasse's GPS coordinates to find the closest
restaurant/cafe/bar and grab its priceLevel.

Usage:
    python -m data.enrich_price_levels [--limit 100] [--delay 0.2]
"""
import argparse
import asyncio
import logging
import time

from sqlalchemy import create_engine, text

from app.config import settings
from app.services.google_places import fetch_price_level

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

PRICE_LABELS = {0: "FREE", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$"}


async def main(limit: int, delay: float) -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT id, nom, adresse,
                       ST_X(geometry) AS lon, ST_Y(geometry) AS lat
                FROM terrasses
                WHERE price_level IS NULL
                ORDER BY id
                LIMIT :limit
            """),
            {"limit": limit},
        ).fetchall()

    logger.info("Found %d terrasses to enrich", len(rows))

    updated = 0
    found_no_price = 0
    not_found = 0

    for i, row in enumerate(rows, 1):
        try:
            price, display_name = await fetch_price_level(row.lat, row.lon)
            if price is not None:
                with engine.connect() as conn:
                    conn.execute(
                        text("UPDATE terrasses SET price_level = :pl WHERE id = :id"),
                        {"pl": price, "id": row.id},
                    )
                    conn.commit()
                updated += 1
                logger.info(
                    "[%d/%d] %s @ %s -> %s (%s)",
                    i, len(rows), row.nom, row.adresse or "?",
                    display_name, PRICE_LABELS.get(price, price),
                )
            elif display_name:
                found_no_price += 1
                logger.info(
                    "[%d/%d] %s -> found '%s' but no price",
                    i, len(rows), row.nom, display_name,
                )
            else:
                not_found += 1
                logger.info(
                    "[%d/%d] %s @ %s -> no restaurant within 30m",
                    i, len(rows), row.nom, row.adresse or "?",
                )
        except Exception as e:
            logger.warning("[%d/%d] %s -> error: %s", i, len(rows), row.nom, e)

        time.sleep(delay)

    logger.info(
        "Done. %d updated, %d found but no price, %d not found (out of %d)",
        updated, found_no_price, not_found, len(rows),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich terrasses with Google Places price level")
    parser.add_argument("--limit", type=int, default=100, help="Max terrasses to process")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay between API calls (seconds)")
    args = parser.parse_args()

    asyncio.run(main(args.limit, args.delay))
