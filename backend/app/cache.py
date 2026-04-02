import json
from typing import Any

import redis.asyncio as redis

from app.config import get_settings

_settings = get_settings()
_client: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(_settings.redis_url, decode_responses=True)
    return _client


async def cache_get(key: str) -> Any | None:
    try:
        r = await get_redis()
        raw = await r.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    try:
        r = await get_redis()
        ttl = ttl if ttl is not None else _settings.cache_ttl_seconds
        await r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass
