"""API routes for terrasses: search, timeline (Mode 1), nearby (Mode 2)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_redis
from app.i18n import get_lang
from app.repositories.terrasse import (
    search_terrasses as repo_search,
    get_with_profile,
    find_nearby,
    find_siblings,
)
from app.schemas.nearby import NearbyResponse
from app.schemas.terrasse import TerrasseSearchResult
from app.schemas.timeline import SiblingTerrasse, TimelineResponse
from app.services.horizon_cache import get_cached_profile
from app.services.nearby import find_nearby_terrasses
from app.services.timeline import build_timeline

PARIS_TZ = ZoneInfo("Europe/Paris")

router = APIRouter(prefix="/api/terrasses", tags=["terrasses"])


@router.get("/search", response_model=list[TerrasseSearchResult])
async def search(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Search terrasses by name or address (trigram similarity)."""
    rows = await repo_search(db, q, limit)
    return [
        TerrasseSearchResult(
            id=r.id, nom=r.nom, nom_commercial=r.nom_commercial,
            adresse=r.adresse,
            arrondissement=r.arrondissement, lat=r.lat, lon=r.lon,
            price_level=r.price_level,
            place_type=r.place_type, rating=r.rating,
            user_rating_count=r.user_rating_count,
            phone=r.phone, website=r.website,
            google_maps_uri=r.google_maps_uri,
        )
        for r in rows
    ]


@router.get("/{terrasse_id}/timeline", response_model=TimelineResponse)
async def get_timeline(
    terrasse_id: int,
    request: Request,
    date_str: str = Query(None, alias="date", description="ISO date (default: today)"),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Mode 1: Get sunshine timeline for a specific terrace.

    If the terrace belongs to an establishment with multiple terrasses (same SIRET),
    the timeline uses union semantics: a slot is sunny if ANY terrace is sunny.
    """
    row = await get_with_profile(db, terrasse_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Terrasse not found")

    profile = await get_cached_profile(redis, terrasse_id, row.profile)
    target_date = date.fromisoformat(date_str) if date_str else date.today()

    # Find sibling terrasses (same SIRET)
    siblings_rows = []
    extra_profiles = []
    surface_totale = 0.0

    if row.siret and row.siret.strip():
        siblings_rows = await find_siblings(db, row.siret)
        for sib in siblings_rows:
            s_surface = (sib.longueur or 0) * (sib.largeur or 0)
            surface_totale += s_surface
            if sib.id != terrasse_id:
                sib_profile = await get_cached_profile(redis, sib.id, sib.profile)
                extra_profiles.append((sib_profile, sib.lat, sib.lon))
    else:
        # Single terrasse, no siblings
        s_surface = (row.longueur or 0) * (row.largeur or 0)
        surface_totale = s_surface

    lang = get_lang(request)
    timeline = await build_timeline(
        profile=profile, lat=row.lat, lon=row.lon,
        target_date=target_date, redis=redis, lang=lang,
        extra_profiles=extra_profiles if extra_profiles else None,
    )

    # Build siblings list for the response
    siblings_out = None
    if len(siblings_rows) > 1:
        siblings_out = [
            SiblingTerrasse(
                id=sib.id,
                adresse=sib.adresse,
                typologie=sib.typologie,
                surface_m2=round((sib.longueur or 0) * (sib.largeur or 0), 1) or None,
                lat=sib.lat,
                lon=sib.lon,
            )
            for sib in siblings_rows
        ]

    return TimelineResponse(
        terrasse=TerrasseSearchResult(
            id=row.id, nom=row.nom, nom_commercial=row.nom_commercial, adresse=row.adresse,
            arrondissement=row.arrondissement, lat=row.lat, lon=row.lon,
            price_level=row.price_level,
            place_type=row.place_type, rating=row.rating,
            user_rating_count=row.user_rating_count,
            phone=row.phone, website=row.website,
            google_maps_uri=row.google_maps_uri,
            surface_m2=round(surface_totale, 1) if surface_totale > 0 else None,
            terrasse_count=len(siblings_rows) if siblings_rows else 1,
        ),
        date=target_date.isoformat(),
        slots=timeline["slots"],
        meilleur_creneau=timeline["meilleur_creneau"],
        meteo_resume=timeline["meteo_resume"],
        siblings=siblings_out,
        surface_totale_m2=round(surface_totale, 1) if surface_totale > 0 else None,
    )


@router.get("/nearby", response_model=NearbyResponse)
async def get_nearby(
    lat: float = Query(..., ge=48.7, le=49.1, description="Latitude"),
    lon: float = Query(..., ge=2.0, le=2.6, description="Longitude"),
    datetime_str: str = Query(None, alias="datetime", description="ISO datetime"),
    radius: int = Query(500, le=1000, description="Radius in meters"),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Mode 2: Find nearby terrasses with sun status."""
    if datetime_str:
        dt = datetime.fromisoformat(datetime_str)
    else:
        dt = datetime.now(tz=PARIS_TZ)

    result = await find_nearby_terrasses(
        session=db, lat=lat, lon=lon, dt=dt,
        radius_m=radius, redis=redis,
    )
    return result
