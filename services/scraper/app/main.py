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

    async def get_or_set(self, key: str, loader: Callable[[], Awaitable[Any]], logger: logging.Logger) -> Any:
        if key in self.local:
            CACHE_HITS.inc()
            return self.local[key]
        if self.redis is not None:
            try:
                raw = await self.redis.get(key)
                if raw is not None:
                    CACHE_HITS.inc()
                    value = json.loads(raw)
                    self.local[key] = value
                    return value
            except Exception:
                logger.warning("redis get failed", exc_info=True)
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

    @app.middleware("http")
    async def metrics(request: Request, call_next):
        start = time.perf_counter()
        status = 500
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

    @app.get("/metrics")
    async def prometheus():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/search")
    async def search(
        q: str = Query(..., min_length=1, max_length=200),
        limit: int = Query(10, ge=1, le=50),
        filter: Literal["songs", "videos", "albums", "artists", "playlists"] = "songs",
    ):
        term = q.strip()
        key = f"scraper:search:{filter}:{limit}:{term.lower()}"
        return {"items": await cache.get_or_set(key, lambda: upstream.search(term, limit, filter), logger)}

    @app.get("/suggestions")
    async def suggestions(q: str = Query(..., min_length=1, max_length=200)):
        term = q.strip()
        return {"items": await cache.get_or_set(f"scraper:suggest:{term.lower()}", lambda: upstream.suggestions(term), logger)}

    @app.get("/artist")
    async def artist(q: str = Query(..., min_length=1, max_length=200)):
        term = q.strip()
        return {"item": await cache.get_or_set(f"scraper:artist:{term.lower()}", lambda: upstream.artist(term), logger)}

    @app.get("/charts")
    async def charts(country: str = Query("ZZ", pattern="^[A-Za-z]{2}$")):
        code = country.upper()
        return {"items": await cache.get_or_set(f"scraper:charts:{code}", lambda: upstream.charts(code), logger)}

    return app
