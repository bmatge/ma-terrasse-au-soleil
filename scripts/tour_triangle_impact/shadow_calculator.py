"""Calcul d'ombrage de la Tour Triangle sur les terrasses.

Algorithme :
1. Pour chaque terrasse, on itère sur 12 mois × 16 heures (6h-21h).
2. Pour chaque slot (mois, heure), on calcule la position du soleil.
3. On vérifie si la terrasse est au soleil SANS la tour (profil d'horizon existant).
4. Si oui, on vérifie si la Tour Triangle obstrue ce rayon solaire.
5. Delta = slots passant de soleil à ombre = heures perdues.
"""
import json
import math
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from pysolar.solar import get_altitude, get_azimuth
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

PARIS_TZ = ZoneInfo("Europe/Paris")

# Meters per degree at Paris latitude
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LON_PARIS = 111_320.0 * math.cos(math.radians(48.86))

# Tour Triangle height
TOUR_HAUTEUR_M = 180.0

# Load tour parcelle geometry
_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def load_tour_geometry() -> Polygon:
    """Load the Tour Triangle parcel geometry from GeoJSON."""
    path = os.path.join(_DATA_DIR, "tour_triangle_parcelle_0023.geojson")
    with open(path) as f:
        data = json.load(f)
    return shape(data["features"][0]["geometry"])


def get_tour_centroid() -> tuple[float, float]:
    """Return (lat, lon) of the Tour Triangle centroid."""
    geom = load_tour_geometry()
    c = geom.centroid
    return c.y, c.x


def get_sun_position(lat: float, lon: float, dt: datetime) -> tuple[float, float]:
    """Return (altitude_deg, azimuth_deg) for the sun.

    dt must be timezone-aware.
    """
    alt = get_altitude(lat, lon, dt)
    azi = get_azimuth(lat, lon, dt) % 360
    return round(alt, 2), round(azi, 2)


def is_sunny(profile: list[float], sun_altitude: float, sun_azimuth: float) -> bool:
    """Check if the sun clears the horizon profile at the given azimuth."""
    if sun_altitude <= 0:
        return False
    az_idx = int(round(sun_azimuth)) % 360
    return sun_altitude > profile[az_idx]


def compute_shadow_polygon(
    tour_geom,
    sun_azimuth: float,
    sun_altitude: float,
    hauteur: float = TOUR_HAUTEUR_M,
):
    """Compute the ground shadow polygon of the tower.

    Returns None if sun is below horizon (no shadow).
    """
    if sun_altitude <= 0:
        return None

    longueur_ombre = hauteur / math.tan(math.radians(sun_altitude))

    # Shadow direction = opposite to sun
    az_rad = math.radians(sun_azimuth)
    dx_m = -longueur_ombre * math.sin(az_rad)
    dy_m = -longueur_ombre * math.cos(az_rad)

    # Convert meters to degrees
    dx_deg = dx_m / M_PER_DEG_LON_PARIS
    dy_deg = dy_m / M_PER_DEG_LAT

    # Shadow = convex hull of parcelle + translated parcelle
    ombre_decalee = translate(tour_geom, xoff=dx_deg, yoff=dy_deg)
    zone_ombre = unary_union([tour_geom, ombre_decalee]).convex_hull

    return zone_ombre


def is_in_tower_shadow(
    lon: float,
    lat: float,
    tour_geom,
    sun_azimuth: float,
    sun_altitude: float,
) -> bool:
    """Check if a point falls within the Tour Triangle's shadow."""
    shadow = compute_shadow_polygon(tour_geom, sun_azimuth, sun_altitude)
    if shadow is None:
        return False
    return shadow.contains(Point(lon, lat))


def compute_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate distance in meters between two WGS84 points (Paris area)."""
    dy = (lat2 - lat1) * M_PER_DEG_LAT
    dx = (lon2 - lon1) * M_PER_DEG_LON_PARIS
    return math.sqrt(dx * dx + dy * dy)


# Months and hours to iterate over
MOIS_RANGE = range(1, 13)
HEURES_RANGE = range(6, 22)  # 6h to 21h inclusive

# Seasonal groupings
MOIS_HIVER = {11, 12, 1, 2}
MOIS_ETE = {4, 5, 6, 7, 8, 9}
HEURES_MIDI = {11, 12, 13, 14}


def compute_terrasse_impact(
    terrasse_lat: float,
    terrasse_lon: float,
    profile: list[float],
    tour_geom,
    annee: int = 2026,
    verbose: bool = False,
) -> dict:
    """Compute the solar impact of the tower on a single terrasse.

    Returns a dict with before/after sun hours and detailed breakdowns.
    """
    heures_avant = 0
    heures_apres = 0
    impact_hiver = 0
    impact_ete = 0
    impact_midi = 0
    impact_par_mois = [0] * 13  # index 1-12

    for mois in MOIS_RANGE:
        # Use the 15th of each month as representative day
        jour = 15
        for heure in HEURES_RANGE:
            # Convert local Paris time to UTC-aware datetime
            try:
                dt_local = datetime(annee, mois, jour, heure, 30, tzinfo=PARIS_TZ)
            except ValueError:
                continue

            alt, azi = get_sun_position(terrasse_lat, terrasse_lon, dt_local)

            # Skip night
            if alt <= 0:
                continue

            # Check current state (without tower)
            sunny_before = is_sunny(profile, alt, azi)
            if not sunny_before:
                continue

            # This slot is sunny without the tower. Check with tower.
            heures_avant += 1

            in_shadow = is_in_tower_shadow(terrasse_lon, terrasse_lat, tour_geom, azi, alt)

            if in_shadow:
                # Lost this hour
                if verbose:
                    print(f"  Mois {mois:2d} {heure:02d}h30 — ombre tour (alt={alt:.1f}° az={azi:.1f}°)")
                if mois in MOIS_HIVER:
                    impact_hiver += 1
                if mois in MOIS_ETE:
                    impact_ete += 1
                if heure in HEURES_MIDI:
                    impact_midi += 1
                impact_par_mois[mois] += 1
            else:
                heures_apres += 1

    heures_perdues = heures_avant - heures_apres
    pct_perte = (heures_perdues / heures_avant * 100) if heures_avant > 0 else 0.0

    # Find most impacted month
    mois_max = max(range(1, 13), key=lambda m: impact_par_mois[m])

    return {
        "heures_soleil_avant": heures_avant,
        "heures_soleil_apres": heures_apres,
        "heures_perdues": heures_perdues,
        "pct_perte": round(pct_perte, 1),
        "impact_hiver": impact_hiver,
        "impact_ete": impact_ete,
        "impact_midi": impact_midi,
        "mois_le_plus_impacte": mois_max if heures_perdues > 0 else 0,
        "impact_par_mois": impact_par_mois,
    }


def compute_shadow_for_moment(
    tour_geom,
    mois: int,
    heure: int,
    label: str,
    annee: int = 2026,
) -> dict | None:
    """Compute shadow polygon for a specific moment (for GeoJSON visualization).

    Returns a GeoJSON Feature dict, or None if sun is below horizon.
    """
    tour_lat, tour_lon = get_tour_centroid()
    jour = 15
    # Use solstice/equinox dates
    if mois == 12:
        jour = 21
    elif mois == 6:
        jour = 21
    elif mois == 3:
        jour = 21

    dt_local = datetime(annee, mois, jour, heure, 30, tzinfo=PARIS_TZ)
    alt, azi = get_sun_position(tour_lat, tour_lon, dt_local)

    if alt <= 0:
        return None

    shadow = compute_shadow_polygon(tour_geom, azi, alt)
    if shadow is None:
        return None

    longueur_ombre = TOUR_HAUTEUR_M / math.tan(math.radians(alt))

    from shapely.geometry import mapping

    return {
        "type": "Feature",
        "properties": {
            "label": label,
            "mois": mois,
            "heure": heure,
            "elevation_soleil": alt,
            "azimut_soleil": azi,
            "longueur_ombre_m": round(longueur_ombre, 0),
            "nb_terrasses_dans_ombre": 0,  # filled later
        },
        "geometry": mapping(shadow),
    }


# Key moments for shadow visualization
MOMENTS_CLES = [
    (12, 12, "Solstice hiver 12h"),
    (12, 15, "Solstice hiver 15h"),
    (3, 12, "Équinoxe printemps 12h"),
    (6, 12, "Solstice été 12h"),
]
