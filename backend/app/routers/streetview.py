"""Proxy for Google Street View Static API (keeps the key server-side)."""
import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.config import settings

router = APIRouter(tags=["streetview"])

STREETVIEW_URL = "https://maps.googleapis.com/maps/api/streetview"


@router.get("/api/streetview")
async def streetview(
    lat: float = Query(...),
    lon: float = Query(...),
) -> Response:
    if not settings.GOOGLE_STREETVIEW_KEY:
        raise HTTPException(status_code=503, detail="Street View non configuré.")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(STREETVIEW_URL, params={
            "size": "600x400",
            "location": f"{lat},{lon}",
            "fov": 120,
            "key": settings.GOOGLE_STREETVIEW_KEY,
        })

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Erreur Street View.")

    return Response(content=resp.content, media_type=resp.headers.get("content-type", "image/jpeg"))
