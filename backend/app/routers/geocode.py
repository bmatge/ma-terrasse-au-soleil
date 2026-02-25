"""Geocoding proxy route."""
from fastapi import APIRouter, Query

from app.schemas.geocode import GeocodeResult
from app.services.geocode import geocode_address

router = APIRouter(prefix="/api", tags=["geocode"])


@router.get("/geocode", response_model=list[GeocodeResult])
async def geocode(
    q: str = Query(..., min_length=3, description="Address query"),
    limit: int = Query(5, le=10),
):
    """Geocode an address (filtered to Paris)."""
    return await geocode_address(q, limit=limit)
