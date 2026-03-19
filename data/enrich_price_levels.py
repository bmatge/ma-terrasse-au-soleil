#!/usr/bin/env python3
"""Batch-enrich terrasses with Google Places data (price, rating, type, phone, website…).

Uses Nearby Search on each terrasse's GPS coordinates to find the closest
restaurant/cafe/bar and grab its details.

Usage:
    python -m data.enrich_price_levels [--limit 100] [--delay 0.2]
"""
import argparse
import asyncio
import logging
import time

from sqlalchemy import create_engine, text

from app.config import settings
from app.services.google_places import fetch_place_info

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
                WHERE price_level IS NULL AND place_type IS NULL
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
            info = await fetch_place_info(row.lat, row.lon)
            if info.display_name:
                with engine.connect() as conn:
                    conn.execute(
                        text("""
                            UPDATE terrasses
                            SET price_level = :price_level,
                                place_type = :place_type,
                                rating = :rating,
                                user_rating_count = :user_rating_count,
                                phone = :phone,
                                website = :website,
                                google_maps_uri = :google_maps_uri
                            WHERE id = :id
                        """),
                        {
                            "price_level": info.price_level,
                            "place_type": info.place_type,
                            "rating": info.rating,
                            "user_rating_count": info.user_rating_count,
                            "phone": info.phone,
                            "website": info.website,
                            "google_maps_uri": info.google_maps_uri,
                            "id": row.id,
                        },
                    )
                    conn.commit()

                if info.price_level is not None:
                    updated += 1
                    logger.info(
                        "[%d/%d] %s @ %s -> %s (type=%s, price=%s, rating=%s)",
                        i, len(rows), row.nom, row.adresse or "?",
                        info.display_name, info.place_type,
                        PRICE_LABELS.get(info.price_level, info.price_level),
                        info.rating,
                    )
                else:
                    found_no_price += 1
                    logger.info(
                        "[%d/%d] %s -> found '%s' (type=%s, rating=%s) but no price",
                        i, len(rows), row.nom, info.display_name,
                        info.place_type, info.rating,
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
    parser = argparse.ArgumentParser(description="Enrich terrasses with Google Places data")
    parser.add_argument("--limit", type=int, default=100, help="Max terrasses to process")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay between API calls (seconds)")
    args = parser.parse_args()

    asyncio.run(main(args.limit, args.delay))
