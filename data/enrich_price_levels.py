#!/usr/bin/env python3
"""Batch-enrich terrasses with Google Places price_level.

Queries terrasses that don't have a price_level yet and fetches it from
the Google Places API. Rate-limited to avoid quota issues.

Usage:
    python data/enrich_price_levels.py [--limit 100] [--delay 0.2]
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


async def main(limit: int, delay: float) -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT id, nom, ST_X(geometry) AS lon, ST_Y(geometry) AS lat
                FROM terrasses
                WHERE price_level IS NULL
                ORDER BY id
                LIMIT :limit
            """),
            {"limit": limit},
        ).fetchall()

    logger.info("Found %d terrasses to enrich", len(rows))

    updated = 0
    for row in rows:
        try:
            price = await fetch_price_level(row.nom, row.lat, row.lon)
            if price is not None:
                with engine.connect() as conn:
                    conn.execute(
                        text("UPDATE terrasses SET price_level = :pl WHERE id = :id"),
                        {"pl": price, "id": row.id},
                    )
                    conn.commit()
                updated += 1
                logger.info("[%d] %s -> price_level=%d", row.id, row.nom, price)
            else:
                logger.info("[%d] %s -> no price data", row.id, row.nom)
        except Exception as e:
            logger.warning("[%d] %s -> error: %s", row.id, row.nom, e)

        time.sleep(delay)

    logger.info("Done. Updated %d / %d terrasses", updated, len(rows))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich terrasses with Google Places price level")
    parser.add_argument("--limit", type=int, default=100, help="Max terrasses to process")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay between API calls (seconds)")
    args = parser.parse_args()

    asyncio.run(main(args.limit, args.delay))
