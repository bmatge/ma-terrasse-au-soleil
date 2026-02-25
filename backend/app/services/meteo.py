"""Open-Meteo weather data with Redis caching.

Fetches hourly cloud cover, direct radiation, and precipitation probability.
Cache is grid-rounded to ~5km (0.05°) — Paris fits in ~4 cells.
"""
import json
from datetime import date

import httpx
from redis.asyncio import Redis

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Round coordinates to 0.05° grid for cache deduplication
GRID_RESOLUTION = 0.05


def _round_to_grid(val: float) -> float:
    return round(round(val / GRID_RESOLUTION) * GRID_RESOLUTION, 3)


async def get_hourly_weather(
    lat: float,
    lon: float,
    target_date: date,
    redis: Redis | None = None,
) -> dict[str, dict]:
    """Fetch hourly weather for a location and date.

    Returns dict keyed by "HH:MM" with values:
        {"cloud_cover": int, "direct_radiation": float, "precipitation_probability": int}
    """
    lat_grid = _round_to_grid(lat)
    lon_grid = _round_to_grid(lon)
    cache_key = f"meteo:{lat_grid}:{lon_grid}:{target_date.isoformat()}"

    # Try Redis cache
    if redis:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

    # Fetch from Open-Meteo
    params = {
        "latitude": lat_grid,
        "longitude": lon_grid,
        "hourly": "cloud_cover,direct_radiation,precipitation_probability",
        "timezone": "Europe/Paris",
        "start_date": target_date.isoformat(),
        "end_date": target_date.isoformat(),
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    # Reshape into {hour: {cloud_cover, direct_radiation, precipitation_probability}}
    hourly: dict[str, dict] = {}
    times = data["hourly"]["time"]
    cloud = data["hourly"]["cloud_cover"]
    radiation = data["hourly"]["direct_radiation"]
    precip = data["hourly"]["precipitation_probability"]

    for i, time_str in enumerate(times):
        hour_key = time_str.split("T")[1][:5]  # "HH:MM"
        hourly[hour_key] = {
            "cloud_cover": cloud[i],
            "direct_radiation": radiation[i],
            "precipitation_probability": precip[i],
        }

    # Cache for 1 hour
    if redis:
        await redis.set(cache_key, json.dumps(hourly), ex=3600)

    return hourly


def weather_status(cloud_cover: int) -> str:
    """Classify weather from cloud cover percentage."""
    if cloud_cover > 80:
        return "couvert"
    if cloud_cover > 50:
        return "mitige"
    return "degage"


def weather_summary(hourly: dict[str, dict]) -> str:
    """Generate a short weather summary for the day."""
    morning = [hourly.get(f"{h:02d}:00", {}).get("cloud_cover", 50) for h in range(8, 12)]
    afternoon = [hourly.get(f"{h:02d}:00", {}).get("cloud_cover", 50) for h in range(12, 18)]

    avg_morning = sum(morning) / max(len(morning), 1)
    avg_afternoon = sum(afternoon) / max(len(afternoon), 1)

    parts = []
    if avg_morning < 30:
        parts.append("Matin ensoleillé")
    elif avg_morning < 60:
        parts.append("Éclaircies le matin")
    else:
        parts.append("Matin nuageux")

    if avg_afternoon < 30:
        parts.append("après-midi dégagé")
    elif avg_afternoon < 60:
        parts.append("éclaircies l'après-midi")
    else:
        parts.append("après-midi couvert")

    return ", ".join(parts)
