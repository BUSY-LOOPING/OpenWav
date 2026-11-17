import json
import logging
import os
import sys
import time
from typing import Any, Awaitable, Callable, Literal, Optional

from cachetools import TTLCache
from fastapi import FastAPI, Query, Request, Response
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

from .upstream import Upstream, UpstreamError

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["route", "method", "status"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30),
)
CACHE_HITS = Counter("scraper_cache_hits_total", "Scraper cache hits")
CACHE_MISSES = Counter("scraper_cache_misses_total", "Scraper cache misses")
CONFIG_KEY = "scraper:config"
CONFIG_REFRESH_SEC = 15


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"level": record.levelname.lower(), "service": "scraper", "msg": record.getMessage(), "time": self.formatTime(record)}
        if record.exc_info:
            payload["err"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging() -> logging.Logger:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("scraper")
    logger.handlers = [handler]
    logger.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    logger.propagate = False
    return logger


class Cache:
    def __init__(self, ttl: int, redis: Any = None):
        self.ttl = ttl
        self.local = TTLCache(maxsize=2048, ttl=ttl)
        self.redis = redis
        self.hits = 0
        self.misses = 0

    def set_ttl(self, ttl: int) -> None:
        if ttl != self.ttl:
            self.ttl = ttl
            self.local = TTLCache(maxsize=2048, ttl=ttl)

    async def clear(self) -> int:
        cleared = len(self.local)
        self.local.clear()
        if self.redis is not None:
            async for key in self.redis.scan_iter(match="scraper:*", count=500):
                if (key.decode() if isinstance(key, bytes) else key) != CONFIG_KEY:
                    await self.redis.delete(key)
                    cleared += 1
        return cleared

    async def get_or_set(self, key: str, loader: Callable[[], Awaitable[Any]], logger: logging.Logger, fresh: bool = False) -> Any:
        if not fresh and key in self.local:
            CACHE_HITS.inc()
            self.hits += 1
            return self.local[key]
        if not fresh and self.redis is not None:
            try:
                raw = await self.redis.get(key)
                if raw is not None:
                    CACHE_HITS.inc()
                    self.hits += 1
                    value = json.loads(raw)
                    self.local[key] = value
                    return value
            except Exception:
                logger.warning("redis get failed", exc_info=True)
        CACHE_MISSES.inc()
        self.misses += 1
        value = await loader()
        if not value:
            return value
        self.local[key] = value
        if self.redis is not None:
            try:
                await self.redis.set(key, json.dumps(value), ex=self.ttl)
            except Exception:
                logger.warning("redis set failed", exc_info=True)
        return value


def create_app(upstream: Optional[Upstream] = None, redis: Any = None) -> FastAPI:
    logger = configure_logging()
    if upstream is None:
        upstream = Upstream(timeout=float(os.getenv("SCRAPER_TIMEOUT_SEC", "8")), concurrency=int(os.getenv("SCRAPER_MAX_CONCURRENCY", "4")))
    if redis is None and os.getenv("REDIS_URL"):
        from redis import asyncio as aioredis

        redis = aioredis.from_url(os.environ["REDIS_URL"])
    cache = Cache(int(os.getenv("SCRAPER_CACHE_TTL_SEC", "21600")), redis)
    app = FastAPI(title="OpenWav scraper")
    refreshed = {"at": None}

    def apply_config(raw: dict) -> None:
        cache.set_ttl(max(0, int(raw.get("cacheTtlSec", cache.ttl))) or 1)
        upstream.timeout = max(1.0, float(raw.get("timeoutSec", upstream.timeout)))
        upstream.retries = max(0, int(raw.get("retries", upstream.retries)))
        concurrency = max(1, int(raw.get("maxConcurrency", upstream.concurrency)))
        if concurrency != upstream.concurrency:
            upstream.concurrency = concurrency
            upstream._semaphore = None

    # Admin changes land in Redis; re-read them at most every few seconds
    async def refresh_config() -> None:
        if redis is None or (refreshed["at"] is not None and time.monotonic() - refreshed["at"] < CONFIG_REFRESH_SEC):
            return
        refreshed["at"] = time.monotonic()
        try:
            raw = await redis.get(CONFIG_KEY)
            if raw:
                apply_config(json.loads(raw))
        except Exception:
            logger.warning("scraper config refresh failed", exc_info=True)

    @app.middleware("http")
    async def metrics(request: Request, call_next):
        start = time.perf_counter()
        status = 500
        await refresh_config()
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            route = request.scope.get("route")
            REQUEST_DURATION.labels(getattr(route, "path", "unmatched"), request.method, str(status)).observe(time.perf_counter() - start)

    @app.exception_handler(UpstreamError)
    async def upstream_failed(_request: Request, exc: UpstreamError):
        logger.warning("upstream failed: %s", exc)
        return JSONResponse(status_code=502, content={"error": {"code": "UPSTREAM", "message": "Scrape failed, try again"}})

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/stats")
    async def stats():
        return {
            "config": {"cacheTtlSec": cache.ttl, "timeoutSec": upstream.timeout, "maxConcurrency": upstream.concurrency, "retries": upstream.retries},
            "cache": {"entries": len(cache.local), "hits": cache.hits, "misses": cache.misses},
        }

    @app.delete("/cache")
    async def clear_cache():
        return {"cleared": await cache.clear()}

    @app.get("/metrics")
    async def prometheus():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/search")
    async def search(
        q: str = Query(..., min_length=1, max_length=200),
        limit: int = Query(10, ge=1, le=50),
        filter: Literal["songs", "videos", "albums", "artists", "playlists"] = "songs",
        fresh: bool = False,
    ):
        term = q.strip()
        key = f"scraper:search:{filter}:{limit}:{term.lower()}"
        return {"items": await cache.get_or_set(key, lambda: upstream.search(term, limit, filter), logger, fresh)}

    @app.get("/suggestions")
    async def suggestions(q: str = Query(..., min_length=1, max_length=200), fresh: bool = False):
        term = q.strip()
        return {"items": await cache.get_or_set(f"scraper:suggest:{term.lower()}", lambda: upstream.suggestions(term), logger, fresh)}

    @app.get("/artist")
    async def artist(q: str = Query(..., min_length=1, max_length=200), fresh: bool = False):
        term = q.strip()
        return {"item": await cache.get_or_set(f"scraper:artist:{term.lower()}", lambda: upstream.artist(term), logger, fresh)}

    @app.get("/related")
    async def related(videoId: str = Query(..., pattern="^[A-Za-z0-9_-]{6,20}$"), fresh: bool = False):
        return {"items": await cache.get_or_set(f"scraper:related:{videoId}", lambda: upstream.related(videoId), logger, fresh)}

    @app.get("/playlist")
    async def playlist(id: str = Query(..., pattern="^[A-Za-z0-9_-]{10,80}$"), fresh: bool = False):
        item = await cache.get_or_set(f"scraper:playlist:{id}", lambda: upstream.playlist(id), logger, fresh)
        if not item:
            return JSONResponse(status_code=404, content={"error": {"code": "NOT_FOUND", "message": "Playlist not found"}})
        return {"item": item}

    @app.get("/charts")
    async def charts(country: str = Query("ZZ", pattern="^[A-Za-z]{2}$"), fresh: bool = False):
        code = country.upper()
        return {"items": await cache.get_or_set(f"scraper:charts:{code}", lambda: upstream.charts(code), logger, fresh)}

    return app
