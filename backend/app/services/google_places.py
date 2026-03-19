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


PRICE_MAP = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


async def fetch_price_level(
    name: str,
    lat: float,
    lon: float,
    adresse: str | None = None,
    radius_m: int = 150,
) -> tuple[int | None, str | None]:
    """Search Google Places for a venue and return (priceLevel, displayName).

    Builds a query combining name + address for better matching, since DB
    names are often legal entity names (raison sociale) rather than the
    public-facing name on Google.

    Returns (None, None) if no match found or API key is not configured.
    """
    if not settings.GOOGLE_PLACES_KEY:
        return None, None

    # Build a richer query: "name, adresse, Paris"
    query_parts = [name]
    if adresse:
        query_parts.append(adresse)
    else:
        query_parts.append("Paris")
    text_query = ", ".join(query_parts)

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": "places.priceLevel,places.displayName",
    }

    body = {
        "textQuery": text_query,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lon},
                "radius": float(radius_m),
            }
        },
        "includedType": "restaurant",
        "maxResultCount": 1,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(PLACES_SEARCH_URL, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()

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
    name: str,
    lat: float,
    lon: float,
    adresse: str | None = None,
) -> int | None:
    """Fetch price level from Google and store it on the terrasse."""
    price_level, display_name = await fetch_price_level(name, lat, lon, adresse=adresse)
    if price_level is not None:
        await session.execute(
            text("UPDATE terrasses SET price_level = :pl WHERE id = :id"),
            {"pl": price_level, "id": terrasse_id},
        )
        await session.commit()
        logger.info("Terrasse %d (%s -> %s): price_level=%d", terrasse_id, name, display_name, price_level)
    return price_level
