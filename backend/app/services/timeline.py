"""Mode 1: Build a full-day sunshine timeline for a specific terrace.

Combines horizon profile (urban shadow) with weather data to produce
15-minute time slots from sunrise to sunset.
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from redis.asyncio import Redis

from app.services.meteo import get_hourly_weather, weather_status, weather_summary
from app.services.shadow import is_sunny
from app.services.sun import get_sun_position, get_sunrise_sunset

PARIS_TZ = ZoneInfo("Europe/Paris")
STEP_MINUTES = 15


def _combined_status(
    sun_altitude: float,
    urban_sunny: bool,
    cloud_cover: int,
) -> str:
    """Determine the combined sun/weather status for a time slot."""
    if sun_altitude <= 0:
        return "nuit"
    if not urban_sunny:
        return "ombre_batiment"
    if cloud_cover > 80:
        return "couvert"
    if cloud_cover > 50:
        return "mitige"
    return "soleil"


def _find_best_window(slots: list[dict]) -> dict | None:
    """Find the longest consecutive 'soleil' streak."""
    best_start = None
    best_len = 0
    cur_start = None
    cur_len = 0

    for slot in slots:
        if slot["status"] == "soleil":
            if cur_start is None:
                cur_start = slot["time"]
            cur_len += 1
        else:
            if cur_len > best_len:
                best_start = cur_start
                best_len = cur_len
            cur_start = None
            cur_len = 0

    if cur_len > best_len:
        best_start = cur_start
        best_len = cur_len

    if best_start is None or best_len == 0:
        return None

    # Compute end time
    start_h, start_m = map(int, best_start.split(":"))
    end_minutes = start_h * 60 + start_m + best_len * STEP_MINUTES
    end_h, end_m = divmod(end_minutes, 60)

    return {
        "debut": best_start,
        "fin": f"{end_h:02d}:{end_m:02d}",
        "duree_minutes": best_len * STEP_MINUTES,
    }


async def build_timeline(
    profile: list[float],
    lat: float,
    lon: float,
    target_date: date,
    redis: Redis | None = None,
) -> dict:
    """Build the full timeline for a terrace on a given date.

    Returns:
        {
            "slots": [{time, sun_altitude, urban_sunny, cloud_cover, status}, ...],
            "meilleur_creneau": {debut, fin, duree_minutes} | null,
            "meteo_resume": str,
        }
    """
    # Get weather data
    weather = await get_hourly_weather(lat, lon, target_date, redis=redis)

    # Get sunrise/sunset for time range
    day_dt = datetime(target_date.year, target_date.month, target_date.day, tzinfo=PARIS_TZ)
    sunrise, sunset = get_sunrise_sunset(lat, lon, day_dt)

    # Start 1h before sunrise, end 1h after sunset (clamped to 6-22h)
    start_hour = max(6, sunrise.hour - 1)
    end_hour = min(22, sunset.hour + 1)

    slots = []
    current = datetime(
        target_date.year, target_date.month, target_date.day,
        start_hour, 0, tzinfo=PARIS_TZ,
    )
    end = current.replace(hour=end_hour, minute=0)

    while current <= end:
        sun_alt, sun_azi = get_sun_position(lat, lon, current)
        urban_sunny = is_sunny(profile, sun_alt, sun_azi)

        # Interpolate cloud cover from hourly data
        hour_key = f"{current.hour:02d}:00"
        hour_weather = weather.get(hour_key, {})
        cloud_cover = hour_weather.get("cloud_cover", 50)

        status = _combined_status(sun_alt, urban_sunny, cloud_cover)

        slots.append({
            "time": current.strftime("%H:%M"),
            "sun_altitude": round(sun_alt, 1),
            "urban_sunny": urban_sunny,
            "cloud_cover": cloud_cover,
            "status": status,
        })

        current += timedelta(minutes=STEP_MINUTES)

    return {
        "slots": slots,
        "meilleur_creneau": _find_best_window(slots),
        "meteo_resume": weather_summary(weather),
    }
