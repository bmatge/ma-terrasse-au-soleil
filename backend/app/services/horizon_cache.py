"""Redis cache for horizon profiles.

Profiles are FLOAT[360] arrays read on every request but rarely changing.
Caching reduces DB load significantly for popular terrasses.
"""
import json

from redis.asyncio import Redis

CACHE_TTL = 86400  # 24 hours


async def get_cached_profile(
    redis: Redis | None,
    terrasse_id: int,
    db_profile: list[float] | None,
) -> list[float]:
    """Get horizon profile, using Redis cache when available.

    Args:
        redis: Redis client (or None to skip caching)
        terrasse_id: Terrasse ID for cache key
        db_profile: Profile from database (may be None)

    Returns:
        The profile as list[float], or [0.0]*360 if none exists
    """
    if db_profile is not None:
        # Cache this profile for next time
        if redis:
            key = f"horizon:{terrasse_id}"
            await redis.set(key, json.dumps(db_profile), ex=CACHE_TTL)
        return db_profile

    # No profile from DB — check cache
    if redis:
        key = f"horizon:{terrasse_id}"
        cached = await redis.get(key)
        if cached:
            return json.loads(cached)

    # No profile anywhere — default flat horizon
    return [0.0] * 360


async def invalidate_profile(redis: Redis | None, terrasse_id: int) -> None:
    """Invalidate cached profile (call after recompute)."""
    if redis:
        await redis.delete(f"horizon:{terrasse_id}")
