"""Shared fixtures for integration tests."""
import asyncio
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies import get_redis


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def fake_redis():
    """Mock Redis that stores data in memory."""
    store: dict = {}
    redis = AsyncMock()
    redis.get = AsyncMock(side_effect=lambda k: store.get(k))
    redis.set = AsyncMock(side_effect=lambda k, v, **kw: store.__setitem__(k, v))

    async def _incr(k):
        store[k] = store.get(k, 0) + 1
        return store[k]

    redis.incr = AsyncMock(side_effect=_incr)
    redis.expire = AsyncMock(return_value=True)
    return redis


@pytest_asyncio.fixture
async def client(fake_redis):
    """Async HTTP client with mocked Redis."""
    app.dependency_overrides[get_redis] = lambda: fake_redis
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
