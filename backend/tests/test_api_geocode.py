"""Integration tests for geocode API endpoint."""
import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_geocode_nominal(client):
    """Geocode should return results for a valid address."""
    mock_results = [
        {"lat": 48.856, "lon": 2.347, "label": "10 Rue de Rivoli, 75001 Paris", "postcode": "75001"}
    ]
    with patch("app.routers.geocode.geocode_address", new_callable=AsyncMock, return_value=mock_results):
        resp = await client.get("/api/geocode", params={"q": "10 rue de rivoli"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["label"] == "10 Rue de Rivoli, 75001 Paris"


@pytest.mark.asyncio
async def test_geocode_empty(client):
    """Geocode with no results returns empty list."""
    with patch("app.routers.geocode.geocode_address", new_callable=AsyncMock, return_value=[]):
        resp = await client.get("/api/geocode", params={"q": "zzzzzzzzz"})
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_geocode_query_too_short(client):
    """Geocode query shorter than 3 chars should return 422."""
    resp = await client.get("/api/geocode", params={"q": "ab"})
    assert resp.status_code == 422
