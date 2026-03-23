"""Mode 2: Find nearby terrasses and their sun status at a given time.

Queries terrasses within a radius, checks their precomputed horizon profiles
against the current sun position, and combines with weather data.

Supports establishment grouping: multiple terrasses per SIRET are merged,
and a group is "sunny" if ANY terrace in it is sunny.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.terrasse import find_nearby as repo_find_nearby
from app.services.meteo import get_hourly_weather, weather_status
from app.services.shadow import is_sunny
from app.services.sun import get_sun_position

PARIS_TZ = ZoneInfo("Europe/Paris")


def _is_any_sunny(profiles_coords: list[tuple], sun_alt: float, sun_azi: float) -> bool:
    """Check if ANY terrace in a group is sunny."""
    for profile, _lat, _lon in profiles_coords:
        if profile is not None and is_sunny(profile, sun_alt, sun_azi):
            return True
    return False


def _estimate_sun_until_group(
    profiles_coords: list[tuple],
    from_dt: datetime,
) -> str | None:
    """Estimate when ALL terraces in the group lose sun (union: latest time)."""
    latest = None
    for profile, lat, lon in profiles_coords:
        if profile is None:
            continue
        end = _estimate_sun_until_single(profile, lat, lon, from_dt)
        if end is None:
            # At least one terrace has sun beyond scan window
            return None
        if latest is None or end > latest:
            latest = end
    return latest


def _estimate_sun_until_single(
    profile: list[float],
    lat: float,
    lon: float,
    from_dt: datetime,
) -> str | None:
    """Estimate when a single terrace will lose sun (up to 4h ahead)."""
    check = from_dt
    for _ in range(4 * 4):  # 4 hours in 15-min steps
        check += timedelta(minutes=15)
        sun_alt, sun_azi = get_sun_position(lat, lon, check)
        if not is_sunny(profile, sun_alt, sun_azi):
            return check.strftime("%H:%M")
    return None


async def find_nearby_terrasses(
    session: AsyncSession,
    lat: float,
    lon: float,
    dt: datetime,
    radius_m: int = 500,
    redis: Redis | None = None,
) -> dict:
    """Find terrasses near a point and their sun status.

    Results are grouped by SIRET (establishment). A group is sunny if ANY
    terrace in it is sunny.

    Returns:
        {
            "meteo": {cloud_cover, status, precipitation_probability},
            "terrasses": [{id, nom, adresse, distance_m, lat, lon, status, ...}, ...]
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

    # Query terrasses (already grouped by SIRET in repository)
    rows = await repo_find_nearby(session, lat, lon, radius_m)

    terrasses = []
    for row in rows:
        # Build profiles list for union check
        profiles_coords = []
        if row.terrasse_count > 1 and row.all_profiles:
            for p, rlat, rlon in zip(row.all_profiles, row.all_lats, row.all_lons):
                profiles_coords.append((p, rlat, rlon))
        else:
            profiles_coords.append((row.profile, row.lat, row.lon))

        # Check sun status (union: any sunny = sunny)
        has_any_profile = any(p is not None for p, _, _ in profiles_coords)
        if not has_any_profile:
            urban_sunny = sun_alt > 0
        else:
            urban_sunny = _is_any_sunny(profiles_coords, sun_alt, sun_azi)

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
        if status == "soleil" and has_any_profile:
            soleil_jusqua = _estimate_sun_until_group(profiles_coords, dt)

        surface_m2 = float(row.surface_m2) if row.surface_m2 and float(row.surface_m2) > 0 else None

        terrasses.append({
            "id": row.id,
            "nom": row.nom,
            "nom_commercial": row.nom_commercial,
            "adresse": row.adresse,
            "lat": row.lat,
            "lon": row.lon,
            "distance_m": row.distance_m,
            "status": status,
            "soleil_jusqua": soleil_jusqua,
            "has_profile": has_any_profile,
            "price_level": row.price_level,
            "place_type": row.place_type,
            "rating": row.rating,
            "user_rating_count": row.user_rating_count,
            "surface_m2": surface_m2,
            "terrasse_count": row.terrasse_count,
        })

    uv_index = hour_weather.get("uv_index", 0.0)

    return {
        "meteo": {
            "cloud_cover": cloud_cover,
            "status": weather_status(cloud_cover),
            "precipitation_probability": hour_weather.get("precipitation_probability", 0),
            "uv_index": round(uv_index, 1),
        },
        "terrasses": terrasses,
    }
