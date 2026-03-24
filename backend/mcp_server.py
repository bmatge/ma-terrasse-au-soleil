"""MCP server for Ma Terrasse au Soleil.

Exposes sunshine data tools so AI assistants can query terrace sunshine
information, find sunny terraces nearby, and generate sunshine profiles.

Served at /mcp via Streamable HTTP transport, mounted in the FastAPI app.
Also runnable standalone: python -m mcp_server
"""

import json
from datetime import date, datetime
from zoneinfo import ZoneInfo

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from app.config import settings
from app.database import async_session
from app.dependencies import get_redis
from app.repositories.terrasse import (
    find_siblings,
    get_with_profile,
    search_terrasses,
)
from app.services.horizon_cache import get_cached_profile
from app.services.nearby import find_nearby_terrasses
from app.services.timeline import build_timeline

PARIS_TZ = ZoneInfo("Europe/Paris")

mcp = FastMCP(
    "Ma Terrasse au Soleil",
    streamable_http_path="/",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=["ausoleil.app", "localhost:8000", "backend:8000"],
    ),
    instructions=(
        "Ce serveur fournit des données d'ensoleillement pour les terrasses de "
        "bars et restaurants à Paris. Vous pouvez rechercher des terrasses, obtenir "
        "leur timeline d'ensoleillement heure par heure, trouver les terrasses "
        "ensoleillées à proximité d'un lieu, et générer des fiches profil "
        "d'ensoleillement détaillées.\n\n"
        "Workflow typique :\n"
        "1. search_terrasses → trouver l'id d'une terrasse\n"
        "2. get_sunshine_timeline → voir l'ensoleillement heure par heure\n"
        "3. get_sunshine_profile → fiche complète avec stats saisonnières\n\n"
        "Ou bien :\n"
        "1. find_sunny_terrasses_nearby → terrasses ensoleillées autour d'un lieu"
    ),
)


# --- MCP Tools ----------------------------------------------------------------


@mcp.tool()
async def search_terrasses_tool(
    query: str,
    limit: int = 10,
) -> str:
    """Rechercher des terrasses par nom d'établissement ou adresse.

    Args:
        query: Texte de recherche (nom du bar/restaurant ou adresse). Min 2 caractères.
        limit: Nombre max de résultats (défaut 10, max 20).

    Returns:
        Liste des terrasses correspondantes avec id, nom, adresse, coordonnées,
        note Google, etc.
    """
    limit = min(limit, 20)
    async with async_session() as db:
        rows = await search_terrasses(db, query, limit)

    results = [
        {
            "id": r.id,
            "nom": r.nom,
            "nom_commercial": r.nom_commercial,
            "adresse": r.adresse,
            "arrondissement": r.arrondissement,
            "lat": r.lat,
            "lon": r.lon,
            "rating": r.rating,
            "user_rating_count": r.user_rating_count,
        }
        for r in rows
    ]
    return json.dumps(results, ensure_ascii=False)


@mcp.tool()
async def get_sunshine_timeline(
    terrasse_id: int,
    date_str: str | None = None,
) -> str:
    """Obtenir la timeline d'ensoleillement d'une terrasse pour une journée.

    Renvoie des créneaux de 15 minutes avec le statut soleil/ombre/couvert,
    ainsi que le meilleur créneau ensoleillé de la journée.

    Si l'établissement possède plusieurs terrasses (même SIRET), la timeline
    utilise la sémantique d'union : un créneau est ensoleillé si AU MOINS UNE
    terrasse est au soleil.

    Args:
        terrasse_id: Identifiant de la terrasse (obtenu via search_terrasses_tool).
        date_str: Date au format ISO (YYYY-MM-DD). Si omis, utilise aujourd'hui.

    Returns:
        Timeline complète avec créneaux, meilleur créneau, résumé météo,
        et informations sur l'établissement.
    """
    redis = await get_redis()
    async with async_session() as db:
        row = await get_with_profile(db, terrasse_id)
        if row is None:
            return json.dumps({"error": "Terrasse non trouvée"}, ensure_ascii=False)

        profile = await get_cached_profile(redis, terrasse_id, row.profile)
        target_date = date.fromisoformat(date_str) if date_str else date.today()

        # Find sibling terrasses (same SIRET)
        extra_profiles = []
        surface_totale = 0.0
        terrasse_count = 1

        if row.siret and row.siret.strip():
            siblings_rows = await find_siblings(db, row.siret)
            terrasse_count = len(siblings_rows)
            for sib in siblings_rows:
                s_surface = (sib.longueur or 0) * (sib.largeur or 0)
                surface_totale += s_surface
                if sib.id != terrasse_id:
                    sib_profile = await get_cached_profile(redis, sib.id, sib.profile)
                    extra_profiles.append((sib_profile, sib.lat, sib.lon))
        else:
            surface_totale = (row.longueur or 0) * (row.largeur or 0)

        timeline = await build_timeline(
            profile=profile,
            lat=row.lat,
            lon=row.lon,
            target_date=target_date,
            redis=redis,
            lang="fr",
            extra_profiles=extra_profiles if extra_profiles else None,
        )

    result = {
        "terrasse": {
            "id": row.id,
            "nom": row.nom,
            "nom_commercial": row.nom_commercial,
            "adresse": row.adresse,
            "arrondissement": row.arrondissement,
            "lat": row.lat,
            "lon": row.lon,
            "surface_m2": round(surface_totale, 1) if surface_totale > 0 else None,
            "terrasse_count": terrasse_count,
        },
        "date": target_date.isoformat(),
        "slots": timeline["slots"],
        "meilleur_creneau": timeline["meilleur_creneau"],
        "meteo_resume": timeline["meteo_resume"],
    }
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def find_sunny_terrasses_nearby(
    lat: float,
    lon: float,
    datetime_str: str | None = None,
    radius: int = 500,
) -> str:
    """Trouver les terrasses ensoleillées à proximité d'un lieu.

    Renvoie les terrasses dans un rayon donné avec leur statut d'ensoleillement
    actuel : soleil, ombre (bâtiment), couvert (nuages), mitigé, ou nuit.

    Args:
        lat: Latitude du point de recherche (Paris : ~48.85).
        lon: Longitude du point de recherche (Paris : ~2.35).
        datetime_str: Date/heure ISO (ex: 2025-06-15T14:30). Si omis, utilise maintenant.
        radius: Rayon de recherche en mètres (défaut 500, max 1000).

    Returns:
        Météo actuelle + liste des terrasses proches triées par distance,
        avec statut d'ensoleillement et estimation de durée du soleil.
    """
    radius = min(radius, 1000)

    if datetime_str:
        dt = datetime.fromisoformat(datetime_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=PARIS_TZ)
    else:
        dt = datetime.now(tz=PARIS_TZ)

    redis = await get_redis()
    async with async_session() as db:
        result = await find_nearby_terrasses(
            session=db, lat=lat, lon=lon, dt=dt, radius_m=radius, redis=redis
        )

    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def get_sunshine_profile(
    terrasse_id: int,
) -> str:
    """Générer une fiche profil d'ensoleillement complète pour une terrasse.

    Analyse le profil d'horizon (obstruction par les bâtiments) et calcule
    des statistiques d'ensoleillement pour différentes saisons, afin de donner
    une vue d'ensemble de la qualité d'ensoleillement de la terrasse.

    La fiche inclut :
    - Informations de l'établissement (nom, adresse, surface)
    - Analyse des orientations (meilleures/pires directions)
    - Stats par saison : heures de soleil, ratio d'ensoleillement, meilleur créneau

    Args:
        terrasse_id: Identifiant de la terrasse.

    Returns:
        Fiche profil complète en JSON.
    """
    redis = await get_redis()
    async with async_session() as db:
        row = await get_with_profile(db, terrasse_id)
        if row is None:
            return json.dumps({"error": "Terrasse non trouvée"}, ensure_ascii=False)

        profile = await get_cached_profile(redis, terrasse_id, row.profile)

        # Find siblings
        extra_profiles = []
        surface_totale = 0.0
        terrasse_count = 1

        if row.siret and row.siret.strip():
            siblings_rows = await find_siblings(db, row.siret)
            terrasse_count = len(siblings_rows)
            for sib in siblings_rows:
                surface_totale += (sib.longueur or 0) * (sib.largeur or 0)
                if sib.id != terrasse_id:
                    sib_profile = await get_cached_profile(redis, sib.id, sib.profile)
                    extra_profiles.append((sib_profile, sib.lat, sib.lon))
        else:
            surface_totale = (row.longueur or 0) * (row.largeur or 0)

    # Analyze horizon profile for orientation quality
    orientations = _analyze_orientations(profile)

    # Compute seasonal sunshine stats
    seasonal_stats = await _compute_seasonal_stats(
        profile, row.lat, row.lon,
        extra_profiles if extra_profiles else None,
    )

    result = {
        "terrasse": {
            "id": row.id,
            "nom": row.nom,
            "nom_commercial": row.nom_commercial,
            "adresse": row.adresse,
            "arrondissement": row.arrondissement,
            "lat": row.lat,
            "lon": row.lon,
            "surface_m2": round(surface_totale, 1) if surface_totale > 0 else None,
            "terrasse_count": terrasse_count,
        },
        "orientations": orientations,
        "stats_saisonnieres": seasonal_stats,
    }
    return json.dumps(result, ensure_ascii=False)


# --- Helpers for sunshine profile ---------------------------------------------


def _analyze_orientations(profile: list[float]) -> dict:
    """Analyze the horizon profile to determine best/worst orientations."""
    directions = {
        "Nord": (0, range(337, 360), range(0, 23)),
        "Nord-Est": (45, range(23, 68)),
        "Est": (90, range(68, 113)),
        "Sud-Est": (135, range(113, 158)),
        "Sud": (180, range(158, 203)),
        "Sud-Ouest": (225, range(203, 248)),
        "Ouest": (270, range(248, 293)),
        "Nord-Ouest": (315, range(293, 338)),
    }

    dir_scores = {}
    for name, (center, *ranges) in directions.items():
        indices = []
        for r in ranges:
            indices.extend(r)
        avg_obstruction = sum(profile[i] for i in indices) / len(indices)
        dir_scores[name] = round(avg_obstruction, 1)

    sorted_dirs = sorted(dir_scores.items(), key=lambda x: x[1])
    best = [d for d, _ in sorted_dirs[:3]]
    worst = [d for d, _ in sorted_dirs[-3:]]

    return {
        "obstruction_par_direction_degres": dir_scores,
        "meilleures_orientations": best,
        "orientations_les_plus_obstruees": worst,
        "commentaire": _orientation_comment(dir_scores),
    }


def _orientation_comment(scores: dict) -> str:
    """Generate a human-readable comment about the orientation profile."""
    south_obs = scores.get("Sud", 0)
    sw_obs = scores.get("Sud-Ouest", 0)
    se_obs = scores.get("Sud-Est", 0)
    south_avg = (south_obs + sw_obs + se_obs) / 3

    if south_avg < 10:
        quality = "excellente exposition sud, très bien dégagée"
    elif south_avg < 20:
        quality = "bonne exposition sud, quelques obstructions modérées"
    elif south_avg < 35:
        quality = "exposition sud moyenne, bâtiments limitant l'ensoleillement"
    else:
        quality = "exposition sud fortement obstruée par les bâtiments environnants"

    return f"Cette terrasse présente une {quality}."


async def _compute_seasonal_stats(
    profile: list[float],
    lat: float,
    lon: float,
    extra_profiles: list[tuple] | None = None,
) -> dict:
    """Compute sunshine statistics for representative dates of each season."""
    seasons = {
        "hiver": date(2025, 12, 21),
        "printemps": date(2025, 3, 21),
        "ete": date(2025, 6, 21),
        "automne": date(2025, 9, 21),
    }

    stats = {}
    for season_name, season_date in seasons.items():
        timeline = await build_timeline(
            profile=profile,
            lat=lat,
            lon=lon,
            target_date=season_date,
            redis=None,  # Clear sky assumption for reference stats
            lang="fr",
            extra_profiles=extra_profiles,
        )

        slots = timeline["slots"]
        sunny_slots = [s for s in slots if s["status"] in ("soleil", "mitige")]
        shadow_slots = [s for s in slots if s["status"] == "ombre_batiment"]
        total_day_slots = [s for s in slots if s["status"] != "nuit"]

        heures_soleil = len(sunny_slots) * 15 / 60
        heures_ombre = len(shadow_slots) * 15 / 60
        heures_jour = len(total_day_slots) * 15 / 60

        stats[season_name] = {
            "date_reference": season_date.isoformat(),
            "heures_de_jour": round(heures_jour, 1),
            "heures_soleil_potentiel": round(heures_soleil, 1),
            "heures_ombre_batiments": round(heures_ombre, 1),
            "ratio_ensoleillement_pct": (
                round(heures_soleil / heures_jour * 100) if heures_jour > 0 else 0
            ),
            "meilleur_creneau": timeline["meilleur_creneau"],
        }

    return stats


# --- Entry point (standalone mode) --------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
