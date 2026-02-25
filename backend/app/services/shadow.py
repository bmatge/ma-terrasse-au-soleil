"""Horizon profile computation and sun/shadow determination.

The horizon profile is a 360-element array where each index represents
an azimuth degree (0=North, 90=East, etc.) and the value is the maximum
elevation angle (in degrees) of obstacles in that direction.

To check if a terrace is sunny: compare the sun's altitude against the
horizon profile at the sun's azimuth. If sun altitude > obstacle elevation,
the terrace receives direct sunlight.
"""
import math

import numpy as np
from shapely import wkt
from shapely.geometry import Polygon
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Observer height above ground (seated at a terrace table)
OBSERVER_HEIGHT_M = 1.5

# Search radius for buildings around a terrace
BUILDING_SEARCH_RADIUS_M = 200.0

# Meters per degree at Paris latitude (~48.86°)
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LON_PARIS = 111_320.0 * math.cos(math.radians(48.86))


def is_sunny(profile: list[float], sun_altitude: float, sun_azimuth: float) -> bool:
    """Check if the sun is visible above the horizon profile.

    Args:
        profile: 360-element list of max elevation angles (degrees) per azimuth.
        sun_altitude: Sun altitude in degrees (0=horizon, 90=zenith).
        sun_azimuth: Sun azimuth in degrees (0=N, 90=E, 180=S, 270=W).

    Returns:
        True if the sun clears all obstacles at its current azimuth.
    """
    if sun_altitude <= 0:
        return False

    az_idx = int(round(sun_azimuth)) % 360
    return sun_altitude > profile[az_idx]


async def compute_horizon_profile(
    session: AsyncSession,
    lat: float,
    lon: float,
    radius_m: float = BUILDING_SEARCH_RADIUS_M,
) -> list[float]:
    """Compute the horizon profile for a point.

    Queries nearby buildings from PostGIS and computes the maximum
    elevation angle of obstacles for each degree of azimuth.
    """
    profile = np.zeros(360, dtype=np.float64)

    # Fetch buildings within radius
    result = await session.execute(
        text("""
            SELECT
                ST_AsText(geometry) AS geom_wkt,
                hauteur,
                COALESCE(altitude_sol, 0) AS altitude_sol
            FROM batiments
            WHERE ST_DWithin(
                geometry::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius
            )
        """),
        {"lat": lat, "lon": lon, "radius": radius_m},
    )
    buildings = result.fetchall()

    for bldg in buildings:
        polygon = wkt.loads(bldg.geom_wkt)
        building_height = bldg.hauteur
        if building_height <= OBSERVER_HEIGHT_M:
            continue

        _update_profile_for_building(profile, lat, lon, polygon, building_height)

    return profile.tolist()


def compute_horizon_profile_sync(
    buildings: list[dict],
    lat: float,
    lon: float,
) -> list[float]:
    """Synchronous version for batch processing.

    Args:
        buildings: list of dicts with keys: geom_wkt, hauteur, altitude_sol
    """
    profile = np.zeros(360, dtype=np.float64)

    for bldg in buildings:
        building_height = bldg["hauteur"]
        if building_height <= OBSERVER_HEIGHT_M:
            continue

        polygon = wkt.loads(bldg["geom_wkt"])
        _update_profile_for_building(profile, lat, lon, polygon, building_height)

    return profile.tolist()


def _update_profile_for_building(
    profile: np.ndarray,
    obs_lat: float,
    obs_lon: float,
    polygon: Polygon,
    building_height: float,
) -> None:
    """Update the horizon profile with a single building's contribution.

    For each edge of the building polygon, compute the azimuth range
    it covers and the elevation angle, then update the profile.
    """
    apparent_height = building_height - OBSERVER_HEIGHT_M

    coords = list(polygon.exterior.coords)
    if len(coords) < 2:
        return

    for i in range(len(coords) - 1):
        x1, y1 = coords[i]
        x2, y2 = coords[i + 1]

        # Convert both vertices to meters relative to observer
        dx1 = (x1 - obs_lon) * M_PER_DEG_LON_PARIS
        dy1 = (y1 - obs_lat) * M_PER_DEG_LAT
        dx2 = (x2 - obs_lon) * M_PER_DEG_LON_PARIS
        dy2 = (y2 - obs_lat) * M_PER_DEG_LAT

        dist1 = math.sqrt(dx1 * dx1 + dy1 * dy1)
        dist2 = math.sqrt(dx2 * dx2 + dy2 * dy2)

        if dist1 < 2.0 and dist2 < 2.0:
            continue  # Skip edges too close (likely the building the terrace is on)

        # Azimuth for each vertex (atan2(dx, dy) gives bearing from north)
        az1 = math.degrees(math.atan2(dx1, dy1)) % 360
        az2 = math.degrees(math.atan2(dx2, dy2)) % 360

        # Elevation angle for each vertex
        elev1 = math.degrees(math.atan2(apparent_height, max(dist1, 1.0)))
        elev2 = math.degrees(math.atan2(apparent_height, max(dist2, 1.0)))

        # Fill azimuth range between the two vertices
        _fill_azimuth_range(profile, az1, elev1, az2, elev2)


def _fill_azimuth_range(
    profile: np.ndarray,
    az1: float,
    elev1: float,
    az2: float,
    elev2: float,
) -> None:
    """Fill the profile between two azimuths with interpolated elevation.

    Takes the shortest arc between az1 and az2 on the 360° circle.
    """
    idx1 = int(round(az1)) % 360
    idx2 = int(round(az2)) % 360

    if idx1 == idx2:
        profile[idx1] = max(profile[idx1], max(elev1, elev2))
        return

    # Compute angular span (shortest arc)
    diff = (idx2 - idx1) % 360
    if diff > 180:
        # Swap to go the shorter way
        idx1, idx2 = idx2, idx1
        elev1, elev2 = elev2, elev1
        diff = 360 - diff

    if diff > 90:
        # Skip very wide arcs (likely a distant/large building seen at a wide angle
        # — individual vertex updates are more accurate)
        profile[int(round(az1)) % 360] = max(profile[int(round(az1)) % 360], elev1)
        profile[int(round(az2)) % 360] = max(profile[int(round(az2)) % 360], elev2)
        return

    for step in range(diff + 1):
        idx = (idx1 + step) % 360
        t = step / max(diff, 1)
        elev = elev1 + t * (elev2 - elev1)
        profile[idx] = max(profile[idx], elev)
