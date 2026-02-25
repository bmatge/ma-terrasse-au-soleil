"""Solar position calculations using pysolar.

Provides sun altitude and azimuth for a given location and datetime.
Azimuth convention: 0°=North, 90°=East, 180°=South, 270°=West (clockwise).
Altitude: 0°=horizon, 90°=zenith, negative=below horizon.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from pysolar.solar import get_altitude, get_azimuth

PARIS_TZ = ZoneInfo("Europe/Paris")

# Paris approximate coordinates for sunrise/sunset estimation
PARIS_LAT = 48.8566
PARIS_LON = 2.3522


def get_sun_position(lat: float, lon: float, dt: datetime) -> tuple[float, float]:
    """Return (altitude_degrees, azimuth_degrees) for the sun.

    The datetime must be timezone-aware. If naive, Paris timezone is assumed.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=PARIS_TZ)

    alt = get_altitude(lat, lon, dt)
    azi = get_azimuth(lat, lon, dt)

    # pysolar azimuth: 0=N, positive=clockwise (E), but can return negatives
    azi = azi % 360

    return round(alt, 2), round(azi, 2)


def get_sunrise_sunset(lat: float, lon: float, dt: datetime) -> tuple[time, time]:
    """Estimate sunrise and sunset times for a given date.

    Returns (sunrise, sunset) as time objects in Paris timezone.
    Uses a simple scan: finds first and last moments where altitude > 0.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=PARIS_TZ)

    day_start = dt.replace(hour=4, minute=0, second=0, microsecond=0)

    sunrise = None
    sunset = None

    for minutes in range(0, 20 * 60, 5):  # scan 04:00 to 00:00 in 5-min steps
        check_dt = day_start + timedelta(minutes=minutes)
        alt, _ = get_sun_position(lat, lon, check_dt)
        if alt > 0:
            if sunrise is None:
                sunrise = check_dt.time()
            sunset = check_dt.time()

    if sunrise is None:
        sunrise = time(8, 0)
    if sunset is None:
        sunset = time(18, 0)

    return sunrise, sunset
