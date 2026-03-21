"""Integration tests for contact API endpoint."""
import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_contact_nominal(client):
    """Contact form should succeed with valid data."""
    with patch("app.routers.contact.aiosmtplib.send", new_callable=AsyncMock):
        resp = await client.post("/api/contact", json={
            "name": "Jean Dupont",
            "email": "jean@example.com",
            "message": "Superbe app !",
        })
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_contact_empty_name(client):
    """Contact form should reject empty name."""
    resp = await client.post("/api/contact", json={
        "name": "   ",
        "email": "jean@example.com",
        "message": "Hello",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_contact_missing_field(client):
    """Contact form should reject missing required fields."""
    resp = await client.post("/api/contact", json={
        "name": "Jean Dupont",
        "email": "jean@example.com",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_contact_empty_message(client):
    """Contact form should reject empty message."""
    resp = await client.post("/api/contact", json={
        "name": "Jean Dupont",
        "email": "jean@example.com",
        "message": "   ",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_contact_smtp_failure(client):
    """Contact form should return 503 when SMTP fails."""
    with patch("app.routers.contact.aiosmtplib.send", new_callable=AsyncMock,
               side_effect=Exception("Connection refused")):
        resp = await client.post("/api/contact", json={
            "name": "Jean Dupont",
            "email": "jean@example.com",
            "message": "Hello",
        })
    assert resp.status_code == 503
