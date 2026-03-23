"""Integration tests for terrasse API endpoints."""
import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_search_terrasses_nominal(client):
    """Search should return results for a valid query."""
    mock_rows = [
        type("Row", (), {
            "id": 1, "nom": "Le Petit Cafe", "nom_commercial": "Le Petit Cafe",
            "adresse": "10 rue de Rivoli", "arrondissement": "75001",
            "lat": 48.856, "lon": 2.347,
            "price_level": 2, "place_type": "cafe", "rating": 4.2,
            "user_rating_count": 150, "phone": "0142424242",
            "website": "https://example.com", "google_maps_uri": None,
        })()
    ]
    with patch("app.routers.terrasses.repo_search", new_callable=AsyncMock, return_value=mock_rows):
        resp = await client.get("/api/terrasses/search", params={"q": "petit"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["nom"] == "Le Petit Cafe"
    assert data[0]["lat"] == 48.856


@pytest.mark.asyncio
async def test_search_terrasses_empty(client):
    """Search with no matches returns empty list."""
    with patch("app.routers.terrasses.repo_search", new_callable=AsyncMock, return_value=[]):
        resp = await client.get("/api/terrasses/search", params={"q": "nonexistent"})
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_search_terrasses_query_too_short(client):
    """Query shorter than 2 chars should return 422."""
    resp = await client.get("/api/terrasses/search", params={"q": "a"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_timeline_nominal(client):
    """Timeline should return slots for a valid terrasse."""
    mock_row = type("Row", (), {
        "id": 1, "nom": "Le Soleil", "nom_commercial": None,
        "adresse": "1 place de la Bastille", "arrondissement": "75004",
        "lat": 48.853, "lon": 2.369,
        "price_level": None, "place_type": "restaurant", "rating": 4.0,
        "user_rating_count": 200, "phone": None,
        "website": None, "google_maps_uri": None,
        "profile": [0.0] * 360,
        "siret": None, "longueur": None, "largeur": None, "typologie": None,
    })()
    mock_timeline = {
        "slots": [
            {"time": "10:00", "sun_altitude": 35.0, "sun_azimuth": 165.2,
             "urban_sunny": True, "cloud_cover": 20, "uv_index": 3.0, "status": "soleil"},
        ],
        "meilleur_creneau": {"debut": "10:00", "fin": "14:00", "duree_minutes": 240},
        "meteo_resume": "Matin ensoleille, apres-midi degagee",
    }
    with patch("app.routers.terrasses.get_with_profile", new_callable=AsyncMock, return_value=mock_row), \
         patch("app.routers.terrasses.build_timeline", new_callable=AsyncMock, return_value=mock_timeline):
        resp = await client.get("/api/terrasses/1/timeline", params={"date": "2026-06-15"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["terrasse"]["id"] == 1
    assert len(data["slots"]) == 1
    assert data["meilleur_creneau"]["duree_minutes"] == 240


@pytest.mark.asyncio
async def test_timeline_not_found(client):
    """Timeline for nonexistent terrasse should return 404."""
    with patch("app.routers.terrasses.get_with_profile", new_callable=AsyncMock, return_value=None):
        resp = await client.get("/api/terrasses/9999/timeline")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_nearby_nominal(client):
    """Nearby should return terrasses with sun status."""
    mock_result = {
        "meteo": {"cloud_cover": 30, "status": "degage", "precipitation_probability": 0, "uv_index": 4.0},
        "terrasses": [
            {"id": 1, "nom": "Bar du Soleil", "nom_commercial": None,
             "adresse": "5 rue de Lappe", "lat": 48.853, "lon": 2.370,
             "distance_m": 120, "status": "soleil", "soleil_jusqua": "16:30",
             "has_profile": True, "price_level": 2, "place_type": "bar",
             "rating": 3.8, "user_rating_count": 80},
        ],
    }
    with patch("app.routers.terrasses.find_nearby_terrasses", new_callable=AsyncMock, return_value=mock_result):
        resp = await client.get("/api/terrasses/nearby", params={
            "lat": 48.853, "lon": 2.369, "datetime": "2026-06-15T14:00:00", "radius": 500
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["meteo"]["status"] == "degage"
    assert len(data["terrasses"]) == 1


@pytest.mark.asyncio
async def test_nearby_out_of_bounds(client):
    """Nearby with out-of-bounds coordinates should return 422."""
    resp = await client.get("/api/terrasses/nearby", params={
        "lat": 45.0, "lon": 2.3
    })
    assert resp.status_code == 422
