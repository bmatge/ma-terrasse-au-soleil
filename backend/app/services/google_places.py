"""Google Places API integration for price level enrichment.

Uses the Places API (New) to fetch priceLevel for terrasses by matching
name + location. Results are stored in the terrasse's price_level column.
"""
import logging

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"


async def fetch_price_level(
    name: str,
    lat: float,
    lon: float,
    radius_m: int = 50,
) -> int | None:
    """Search Google Places for a venue and return its priceLevel (0-4).

    Returns None if no match found or API key is not configured.
    """
    if not settings.GOOGLE_PLACES_KEY:
        return None

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": "places.priceLevel",
    }

    body = {
        "textQuery": name,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lon},
                "radius": float(radius_m),
            }
        },
        "maxResultCount": 1,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(PLACES_SEARCH_URL, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    places = data.get("places", [])
    if not places:
        return None

    # priceLevel: PRICE_LEVEL_FREE=0, PRICE_LEVEL_INEXPENSIVE=1,
    # PRICE_LEVEL_MODERATE=2, PRICE_LEVEL_EXPENSIVE=3, PRICE_LEVEL_VERY_EXPENSIVE=4
    price_str = places[0].get("priceLevel")
    if price_str is None:
        return None

    price_map = {
        "PRICE_LEVEL_FREE": 0,
        "PRICE_LEVEL_INEXPENSIVE": 1,
        "PRICE_LEVEL_MODERATE": 2,
        "PRICE_LEVEL_EXPENSIVE": 3,
        "PRICE_LEVEL_VERY_EXPENSIVE": 4,
    }
    return price_map.get(price_str)


async def enrich_terrasse_price(
    session: AsyncSession,
    terrasse_id: int,
    name: str,
    lat: float,
    lon: float,
) -> int | None:
    """Fetch price level from Google and store it on the terrasse."""
    price_level = await fetch_price_level(name, lat, lon)
    if price_level is not None:
        await session.execute(
            text("UPDATE terrasses SET price_level = :pl WHERE id = :id"),
            {"pl": price_level, "id": terrasse_id},
        )
        await session.commit()
        logger.info("Terrasse %d (%s): price_level=%d", terrasse_id, name, price_level)
    return price_level
