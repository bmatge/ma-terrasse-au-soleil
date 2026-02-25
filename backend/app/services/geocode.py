"""Geocoding via Géoplateforme (successor to API BAN).

Proxies search requests and filters results to Paris (75xxx postcodes).
"""
import logging

import httpx

log = logging.getLogger(__name__)

GEOCODE_URL = "https://data.geopf.fr/geocodage/search"


async def geocode_address(query: str, limit: int = 5) -> list[dict]:
    """Geocode an address query, filtered to Paris.

    Returns list of dicts: {lat, lon, label, postcode}
    """
    params = {
        "q": query,
        "limit": limit * 2,  # Fetch extra to compensate for filtering
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(GEOCODE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Geocode request failed: %s", exc)
        return []

    results = []
    for feature in data.get("features", []):
        props = feature["properties"]
        postcode = props.get("postcode", "")
        if not postcode.startswith("750"):
            continue

        coords = feature["geometry"]["coordinates"]
        results.append({
            "lat": coords[1],
            "lon": coords[0],
            "label": props.get("label", ""),
            "postcode": postcode,
        })

        if len(results) >= limit:
            break

    return results
