"""Shared FastAPI dependencies."""
from redis.asyncio import Redis

from app.config import settings

_redis: Redis | None = None


async def init_redis() -> None:
    global _redis
    _redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.close()
        _redis = None


async def get_redis() -> Redis | None:
    return _redis
