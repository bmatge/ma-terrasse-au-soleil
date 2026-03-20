"""OpenStreetMap Overpass API integration for enriching terrasse data.

Downloads all bars/pubs/cafes/restaurants in Paris and provides matching
by SIRET or spatial proximity + fuzzy name.
"""
import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from rapidfuzz import fuzz

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Query all bars/pubs/cafes/restaurants in Paris with all tags
OVERPASS_QUERY = """
[out:json][timeout:120];
area["name"="Paris"]["admin_level"="8"]->.paris;
nwr["amenity"~"^(bar|pub|cafe|restaurant|biergarten)$"](area.paris);
out center tags;
"""

RAW_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "raw"
CACHE_FILE = RAW_DIR / "osm_paris_pois.json"


@dataclass
class OsmPoi:
    """A point of interest from OpenStreetMap."""
    osm_id: int
    osm_type: str  # "node", "way", "relation"
    lat: float
    lon: float
    name: str | None = None
    amenity: str | None = None
    siret: str | None = None
    phone: str | None = None
    website: str | None = None
    opening_hours: str | None = None
    cuisine: str | None = None
    outdoor_seating: bool | None = None
    addr_housenumber: str | None = None
    addr_street: str | None = None
    addr_postcode: str | None = None
    tags: dict = field(default_factory=dict)


def _parse_element(el: dict) -> OsmPoi | None:
    """Parse an Overpass element into an OsmPoi."""
    tags = el.get("tags", {})

    # Get coordinates: nodes have lat/lon directly, ways/relations have center
    if el["type"] == "node":
        lat, lon = el.get("lat"), el.get("lon")
    else:
        center = el.get("center", {})
        lat, lon = center.get("lat"), center.get("lon")

    if lat is None or lon is None:
        return None

    # Parse outdoor_seating
    os_val = tags.get("outdoor_seating")
    outdoor_seating = None
    if os_val == "yes":
        outdoor_seating = True
    elif os_val == "no":
        outdoor_seating = False

    # Normalize SIRET (remove spaces)
    siret = tags.get("ref:FR:SIRET", "").replace(" ", "").strip() or None

    return OsmPoi(
        osm_id=el["id"],
        osm_type=el["type"],
        lat=lat,
        lon=lon,
        name=tags.get("name"),
        amenity=tags.get("amenity"),
        siret=siret,
        phone=tags.get("phone") or tags.get("contact:phone"),
        website=tags.get("website") or tags.get("contact:website"),
        opening_hours=tags.get("opening_hours"),
        cuisine=tags.get("cuisine"),
        outdoor_seating=outdoor_seating,
        addr_housenumber=tags.get("addr:housenumber") or tags.get("contact:housenumber"),
        addr_street=tags.get("addr:street") or tags.get("contact:street"),
        addr_postcode=tags.get("addr:postcode") or tags.get("contact:postcode"),
        tags=tags,
    )


async def download_osm_pois(force: bool = False) -> list[OsmPoi]:
    """Download all bar/pub/cafe/restaurant POIs in Paris from Overpass.

    Results are cached to data/raw/osm_paris_pois.json.
    Use force=True to re-download.
    """
    if CACHE_FILE.exists() and not force:
        logger.info("Loading cached OSM POIs from %s", CACHE_FILE)
        with open(CACHE_FILE) as f:
            data = json.load(f)
        pois = [_parse_element(el) for el in data["elements"]]
        pois = [p for p in pois if p is not None]
        logger.info("Loaded %d OSM POIs from cache", len(pois))
        return pois

    logger.info("Downloading OSM POIs from Overpass API...")
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(
            OVERPASS_URL,
            data={"data": OVERPASS_QUERY},
            headers={"User-Agent": "ma-terrasse-au-soleil/1.0"},
        )
        resp.raise_for_status()
        data = resp.json()

    # Cache raw response
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)

    pois = [_parse_element(el) for el in data["elements"]]
    pois = [p for p in pois if p is not None]
    logger.info("Downloaded %d OSM POIs", len(pois))
    return pois


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters between two points."""
    import math
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _normalize_siret(siret: str | None) -> str | None:
    """Normalize SIRET: remove spaces, keep only digits."""
    if not siret:
        return None
    cleaned = "".join(c for c in siret if c.isdigit())
    return cleaned if len(cleaned) >= 9 else None


def match_terrasse_to_osm(
    terrasse_lat: float,
    terrasse_lon: float,
    terrasse_nom: str | None,
    terrasse_siret: str | None,
    pois: list[OsmPoi],
    max_distance_m: float = 50.0,
    min_name_score: int = 60,
) -> OsmPoi | None:
    """Match a terrasse to an OSM POI.

    Strategy (by decreasing confidence):
    1. SIRET match (exact) — most reliable
    2. Proximity + fuzzy name match — good fallback
    """
    norm_siret = _normalize_siret(terrasse_siret)

    # 1. SIRET match
    if norm_siret:
        for poi in pois:
            poi_siret = _normalize_siret(poi.siret)
            if poi_siret and poi_siret == norm_siret:
                logger.debug("SIRET match: %s -> %s", terrasse_nom, poi.name)
                return poi

    # 2. Proximity + name match
    candidates = []
    for poi in pois:
        dist = _haversine_m(terrasse_lat, terrasse_lon, poi.lat, poi.lon)
        if dist <= max_distance_m:
            candidates.append((poi, dist))

    if not candidates:
        return None

    # Sort by distance first
    candidates.sort(key=lambda x: x[1])

    # If we have a name, try fuzzy matching
    if terrasse_nom:
        best_poi = None
        best_score = 0
        for poi, dist in candidates:
            if not poi.name:
                continue
            score = fuzz.token_sort_ratio(terrasse_nom.lower(), poi.name.lower())
            # Bonus for very close POIs
            if dist < 15:
                score += 10
            if score > best_score:
                best_score = score
                best_poi = poi

        if best_poi and best_score >= min_name_score:
            logger.debug(
                "Name match (score=%d): %s -> %s",
                best_score, terrasse_nom, best_poi.name,
            )
            return best_poi

    # If no name match, take the closest if it's very close (<20m)
    closest_poi, closest_dist = candidates[0]
    if closest_dist < 20:
        logger.debug(
            "Proximity match (%.0fm): %s -> %s",
            closest_dist, terrasse_nom, closest_poi.name,
        )
        return closest_poi

    return None
