"""API routes for terrasses: search, timeline (Mode 1), nearby (Mode 2)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_redis
from app.schemas.nearby import NearbyResponse
from app.schemas.terrasse import TerrasseSearchResult
from app.schemas.timeline import TimelineResponse
from app.services.nearby import find_nearby_terrasses
from app.services.timeline import build_timeline

PARIS_TZ = ZoneInfo("Europe/Paris")

router = APIRouter(prefix="/api/terrasses", tags=["terrasses"])


@router.get("/search", response_model=list[TerrasseSearchResult])
async def search_terrasses(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Search terrasses by name or address (trigram similarity)."""
    result = await db.execute(
        text("""
            SELECT
                id, nom, adresse, arrondissement,
                ST_X(geometry) AS lon, ST_Y(geometry) AS lat,
                similarity(nom, :q) AS sim
            FROM terrasses
            WHERE nom % :q OR adresse % :q
            ORDER BY sim DESC
            LIMIT :limit
        """),
        {"q": q, "limit": limit},
    )
    rows = result.fetchall()

    if not rows:
        # Fallback: ILIKE search
        result = await db.execute(
            text("""
                SELECT
                    id, nom, adresse, arrondissement,
                    ST_X(geometry) AS lon, ST_Y(geometry) AS lat
                FROM terrasses
                WHERE nom ILIKE :pattern OR adresse ILIKE :pattern
                ORDER BY nom
                LIMIT :limit
            """),
            {"pattern": f"%{q}%", "limit": limit},
        )
        rows = result.fetchall()

    return [
        TerrasseSearchResult(
            id=r.id, nom=r.nom, adresse=r.adresse,
            arrondissement=r.arrondissement, lat=r.lat, lon=r.lon,
        )
        for r in rows
    ]


@router.get("/{terrasse_id}/timeline", response_model=TimelineResponse)
async def get_timeline(
    terrasse_id: int,
    date_str: str = Query(None, alias="date", description="ISO date (default: today)"),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Mode 1: Get sunshine timeline for a specific terrace."""
    # Fetch terrace + profile
    result = await db.execute(
        text("""
            SELECT
                t.id, t.nom, t.adresse, t.arrondissement,
                ST_X(t.geometry) AS lon, ST_Y(t.geometry) AS lat,
                hp.profile
            FROM terrasses t
            LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE t.id = :id
        """),
        {"id": terrasse_id},
    )
    row = result.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Terrasse not found")

    profile = row.profile if row.profile else [0.0] * 360
    target_date = date.fromisoformat(date_str) if date_str else date.today()

    timeline = await build_timeline(
        profile=profile, lat=row.lat, lon=row.lon,
        target_date=target_date, redis=redis,
    )

    return TimelineResponse(
        terrasse=TerrasseSearchResult(
            id=row.id, nom=row.nom, adresse=row.adresse,
            arrondissement=row.arrondissement, lat=row.lat, lon=row.lon,
        ),
        date=target_date.isoformat(),
        slots=timeline["slots"],
        meilleur_creneau=timeline["meilleur_creneau"],
        meteo_resume=timeline["meteo_resume"],
    )


@router.get("/nearby", response_model=NearbyResponse)
async def get_nearby(
    lat: float = Query(..., ge=48.8, le=48.92, description="Latitude"),
    lon: float = Query(..., ge=2.22, le=2.47, description="Longitude"),
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
