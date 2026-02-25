"""Mode 2: Find nearby terrasses and their sun status at a given time.

Queries terrasses within a radius, checks their precomputed horizon profiles
against the current sun position, and combines with weather data.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.meteo import get_hourly_weather, weather_status
from app.services.shadow import is_sunny
from app.services.sun import get_sun_position

PARIS_TZ = ZoneInfo("Europe/Paris")


async def find_nearby_terrasses(
    session: AsyncSession,
    lat: float,
    lon: float,
    dt: datetime,
    radius_m: int = 500,
    redis: Redis | None = None,
) -> dict:
    """Find terrasses near a point and their sun status.

    Returns:
        {
            "meteo": {cloud_cover, status, precipitation_probability},
            "terrasses": [{id, nom, adresse, distance_m, lat, lon, status, soleil_jusqua}, ...]
        }
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=PARIS_TZ)

    # Get sun position
    sun_alt, sun_azi = get_sun_position(lat, lon, dt)

    # Get weather
    weather = await get_hourly_weather(lat, lon, dt.date(), redis=redis)
    hour_key = f"{dt.hour:02d}:00"
    hour_weather = weather.get(hour_key, {})
    cloud_cover = hour_weather.get("cloud_cover", 50)

    # Query terrasses with their horizon profiles
    result = await session.execute(
        text("""
            SELECT
                t.id,
                t.nom,
                t.adresse,
                ST_X(t.geometry) AS lon,
                ST_Y(t.geometry) AS lat,
                ST_Distance(
                    t.geometry::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                )::int AS distance_m,
                hp.profile
            FROM terrasses t
            LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE ST_DWithin(
                t.geometry::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius
            )
            ORDER BY distance_m
            LIMIT 50
        """),
        {"lat": lat, "lon": lon, "radius": radius_m},
    )
    rows = result.fetchall()

    terrasses = []
    for row in rows:
        profile = row.profile
        if profile is None:
            # No horizon profile computed yet — assume sunny if sun is up
            urban_sunny = sun_alt > 0
        else:
            urban_sunny = is_sunny(profile, sun_alt, sun_azi)

        # Determine combined status
        if sun_alt <= 0:
            status = "nuit"
        elif not urban_sunny:
            status = "ombre"
        elif cloud_cover > 80:
            status = "couvert"
        elif cloud_cover > 50:
            status = "mitige"
        else:
            status = "soleil"

        # Estimate "sunny until" if currently sunny
        soleil_jusqua = None
        if status == "soleil" and profile is not None:
            soleil_jusqua = _estimate_sun_until(profile, row.lat, row.lon, dt)

        terrasses.append({
            "id": row.id,
            "nom": row.nom,
            "adresse": row.adresse,
            "lat": row.lat,
            "lon": row.lon,
            "distance_m": row.distance_m,
            "status": status,
            "soleil_jusqua": soleil_jusqua,
        })

    return {
        "meteo": {
            "cloud_cover": cloud_cover,
            "status": weather_status(cloud_cover),
            "precipitation_probability": hour_weather.get("precipitation_probability", 0),
        },
        "terrasses": terrasses,
    }


def _estimate_sun_until(
    profile: list[float],
    lat: float,
    lon: float,
    from_dt: datetime,
) -> str | None:
    """Estimate when a terrace will lose sun (up to 4h ahead).

    Returns "HH:MM" or None if sun lasts beyond the scan window.
    """
    from datetime import timedelta

    check = from_dt
    for _ in range(4 * 4):  # 4 hours in 15-min steps
        check += timedelta(minutes=15)
        sun_alt, sun_azi = get_sun_position(lat, lon, check)
        if not is_sunny(profile, sun_alt, sun_azi):
            return check.strftime("%H:%M")
    return None
