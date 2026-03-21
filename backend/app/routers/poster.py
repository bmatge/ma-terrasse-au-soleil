"""API route for poster generation."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.poster import generate_poster

router = APIRouter(prefix="/api/terrasses", tags=["poster"])


@router.get("/{terrasse_id}/poster", response_class=Response)
async def get_poster(
    terrasse_id: int,
    year: int = Query(default=None, description="Year for the chart (default: current)"),
    db: AsyncSession = Depends(get_db),
):
    """Generate a sunshine poster PNG for a terrace."""
    result = await db.execute(
        text("""
            SELECT
                t.id,
                COALESCE(t.nom_commercial, t.nom) AS display_name,
                t.adresse,
                t.arrondissement,
                ST_X(t.geometry) AS lon,
                ST_Y(t.geometry) AS lat,
                t.longueur,
                t.largeur,
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
    if row.profile is None:
        raise HTTPException(
            status_code=422,
            detail="Horizon profile not computed for this terrace",
        )

    poster_year = year or date.today().year
    surface = (
        round(row.longueur * row.largeur, 1)
        if row.longueur and row.largeur
        else None
    )

    # Build address with arrondissement
    address = row.adresse or ""
    if row.arrondissement:
        address = f"{address}\n{row.arrondissement} Paris"

    slug = row.display_name.lower().replace(" ", "-").replace("'", "-")
    qr_url = f"https://ausoleil.app/terrasse/{terrasse_id}"

    png_bytes = generate_poster(
        name=row.display_name,
        address=address,
        lat=row.lat,
        lon=row.lon,
        profile=row.profile,
        year=poster_year,
        qr_url=qr_url,
        surface_m2=surface,
    )

    filename = f"ausoleil-{slug}-{poster_year}.png"
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "public, max-age=86400",
        },
    )
