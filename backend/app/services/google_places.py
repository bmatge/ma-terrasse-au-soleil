"""Google Places API integration for enriching terrasse data.

Uses the Places API (New) Nearby Search to find the closest restaurant/bar/cafe
to a terrasse's GPS coordinates and fetch price level, rating, phone, website, etc.
"""
import logging
from dataclasses import dataclass

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

FIELD_MASK = ",".join([
    "places.name",
    "places.priceLevel",
    "places.displayName",
    "places.location",
    "places.primaryType",
    "places.rating",
    "places.userRatingCount",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
])


@dataclass
class PlaceInfo:
    """Data fetched from Google Places API."""
    google_place_id: str | None = None
    price_level: int | None = None
    display_name: str | None = None
    place_type: str | None = None
    rating: float | None = None
    user_rating_count: int | None = None
    phone: str | None = None
    website: str | None = None
    google_maps_uri: str | None = None


async def fetch_place_info(
    lat: float,
    lon: float,
    radius_m: float = 30.0,
) -> PlaceInfo:
    """Find the nearest restaurant/bar/cafe via Nearby Search and return its details.

    Uses a tight radius (30m default) around the terrasse's exact GPS coords
    to find the matching venue by proximity rather than name.
    """
    if not settings.GOOGLE_PLACES_KEY:
        logger.warning("GOOGLE_PLACES_KEY is not set, skipping")
        return PlaceInfo()

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
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
        return PlaceInfo()

    place = places[0]

    price_str = place.get("priceLevel")
    price_level = PRICE_MAP.get(price_str) if price_str else None

    # "name" is "places/{placeId}" — extract just the ID
    raw_name = place.get("name", "")
    place_id = raw_name.split("/")[-1] if raw_name else None

    return PlaceInfo(
        google_place_id=place_id,
        price_level=price_level,
        display_name=place.get("displayName", {}).get("text"),
        place_type=place.get("primaryType"),
        rating=place.get("rating"),
        user_rating_count=place.get("userRatingCount"),
        phone=place.get("nationalPhoneNumber"),
        website=place.get("websiteUri"),
        google_maps_uri=place.get("googleMapsUri"),
    )


# Keep backward-compatible wrapper for existing callers
async def fetch_price_level(
    lat: float,
    lon: float,
    radius_m: float = 30.0,
) -> tuple[int | None, str | None]:
    """Backward-compatible wrapper returning (priceLevel, displayName)."""
    info = await fetch_place_info(lat, lon, radius_m)
    return info.price_level, info.display_name


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
