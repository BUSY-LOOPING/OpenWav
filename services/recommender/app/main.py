import os
import threading
import time
from contextlib import asynccontextmanager
from typing import List, Optional
from uuid import UUID

from fastapi import BackgroundTasks, FastAPI, Query, Request, Response
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, Histogram, generate_latest

from .service import Service, configure_logging, run_consumer, run_trainer

HTTP_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["route", "method", "status"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)


def _ids(raw: Optional[str]) -> List[str]:
    return [part.strip() for part in raw.split(",") if part.strip()] if raw else []


def _summary(model) -> dict:
    return {
        "version": model.version,
        "trainedAt": model.trained_at.isoformat() if model.trained_at else None,
        "users": len(model.users),
        "items": len(model.items),
    }


def build_app(service: Service, background: Optional[dict] = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        stop = threading.Event()
        if background:
            service.store.ensure_schema()
            threading.Thread(target=run_trainer, args=(service, background["interval"], stop), daemon=True).start()
            if background.get("brokers"):
                threading.Thread(target=run_consumer, args=(service, background["brokers"], stop), daemon=True).start()
        yield
        stop.set()

    app = FastAPI(title="OpenWav recommender", lifespan=lifespan)

    @app.middleware("http")
    async def observe(request: Request, call_next):
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            route = request.scope.get("route")
            HTTP_DURATION.labels(route=getattr(route, "path", "unmatched"), method=request.method,
                                 status=str(status)).observe(time.perf_counter() - started)

    @app.get("/health")
    def health():
        return {"status": "ok", "modelVersion": service.model.version}

    @app.get("/metrics")
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/recommendations/{user_id}")
    def recommendations(user_id: UUID, limit: int = Query(20, ge=1, le=100), exclude: Optional[str] = None):
        return {"items": service.recommend(str(user_id), limit, _ids(exclude))}

    @app.get("/similar/{media_id}")
    def similar(media_id: UUID, limit: int = Query(20, ge=1, le=100), exclude: Optional[str] = None):
        return {"items": service.similar(str(media_id), limit, _ids(exclude))}

    @app.post("/train", status_code=202)
    def train(tasks: BackgroundTasks):
        tasks.add_task(service._safe_train)
        return {"status": "accepted"}

    @app.get("/model")
    def model():
        return _summary(service.model)

    @app.get("/insights")
    def insights():
        return {
            "status": service.status,
            "model": _summary(service.model),
            "params": service.params(),
            "runs": service.store.recent_models(),
            "data": service.store.data_overview(),
        }

    @app.exception_handler(Exception)
    async def unhandled(_request: Request, _exc: Exception):
        return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL", "message": "internal error"}})

    return app


def create_app() -> FastAPI:
    from .store import PgStore

    configure_logging(os.environ.get("LOG_LEVEL", "info"))
    service = Service(
        PgStore(os.environ["DATABASE_URL"]),
        os.environ.get("MODEL_DIR", "/data"),
        float(os.environ.get("RECOMMENDER_CONTENT_WEIGHT", "0.3")),
        int(os.environ.get("RECOMMENDER_TRAIN_AFTER_EVENTS", "500")),
    )
    return build_app(service, {
        "interval": float(os.environ.get("RECOMMENDER_TRAIN_INTERVAL_SEC", "900")),
        "brokers": os.environ.get("KAFKA_BROKERS"),
    })
