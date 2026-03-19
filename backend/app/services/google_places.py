"""Google Places API integration for price level enrichment.

Uses the Places API (New) Nearby Search to find the closest restaurant
to a terrasse's GPS coordinates and fetch its priceLevel. This approach
is more reliable than text search because DB names are legal entity names
(raison sociale) that rarely match the public-facing Google name.
"""
import logging

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"

PRICE_MAP = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


async def fetch_price_level(
    lat: float,
    lon: float,
    radius_m: float = 30.0,
) -> tuple[int | None, str | None]:
    """Find the nearest restaurant via Nearby Search and return (priceLevel, displayName).

    Uses a tight radius (30m default) around the terrasse's exact GPS coords
    to find the matching venue by proximity rather than name.

    Returns (None, None) if no match found or API key is not configured.
    """
    if not settings.GOOGLE_PLACES_KEY:
        logger.warning("GOOGLE_PLACES_KEY is not set, skipping")
        return None, None

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": "places.priceLevel,places.displayName,places.location",
    }

    body = {
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lon},
                "radius": radius_m,
            }
        },
        "includedTypes": ["restaurant", "cafe", "bar"],
        "maxResultCount": 1,
        "rankPreference": "DISTANCE",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(NEARBY_SEARCH_URL, json=body, headers=headers)
        if resp.status_code != 200:
            logger.error("Google API error %d: %s", resp.status_code, resp.text[:500])
            resp.raise_for_status()
        data = resp.json()

    logger.debug("Google response for (%.5f, %.5f): %s", lat, lon, data)

    places = data.get("places", [])
    if not places:
        return None, None

    place = places[0]
    display_name = place.get("displayName", {}).get("text")

    price_str = place.get("priceLevel")
    if price_str is None:
        return None, display_name

    return PRICE_MAP.get(price_str), display_name


async def enrich_terrasse_price(
    session: AsyncSession,
    terrasse_id: int,
    lat: float,
    lon: float,
) -> int | None:
    """Fetch price level from Google and store it on the terrasse."""
    price_level, display_name = await fetch_price_level(lat, lon)
    if price_level is not None:
        await session.execute(
            text("UPDATE terrasses SET price_level = :pl WHERE id = :id"),
            {"pl": price_level, "id": terrasse_id},
        )
        await session.commit()
        logger.info("Terrasse %d -> %s: price_level=%d", terrasse_id, display_name, price_level)
    return price_level
