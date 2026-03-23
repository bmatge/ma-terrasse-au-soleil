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
    """Generate a sunshine poster PNG for a terrace.

    If the terrace belongs to an establishment with multiple terrasses (same SIRET),
    the poster uses the union of all horizon profiles and aggregated surface.
    """
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
                t.siret,
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

    # Collect all profiles and surface for siblings (same SIRET)
    profiles = []
    total_surface = 0.0
    terrasse_count = 1

    if row.siret and row.siret.strip():
        siblings = await db.execute(
            text("""
                SELECT
                    t.longueur, t.largeur, hp.profile
                FROM terrasses t
                LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
                WHERE t.siret = :siret AND t.siret != ''
            """),
            {"siret": row.siret},
        )
        sibling_rows = siblings.fetchall()
        terrasse_count = len(sibling_rows)
        for sib in sibling_rows:
            p = sib.profile if sib.profile is not None else [0.0] * 360
            profiles.append(p)
            if sib.longueur and sib.largeur:
                total_surface += sib.longueur * sib.largeur
    else:
        profile = row.profile if row.profile is not None else [0.0] * 360
        profiles.append(profile)
        if row.longueur and row.largeur:
            total_surface = row.longueur * row.largeur

    poster_year = year or date.today().year
    surface = round(total_surface, 1) if total_surface > 0 else None

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
        profiles=profiles,
        year=poster_year,
        qr_url=qr_url,
        surface_m2=surface,
        terrasse_count=terrasse_count,
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
