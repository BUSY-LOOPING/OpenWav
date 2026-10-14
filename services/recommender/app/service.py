import json
import logging
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Iterable, List, Optional

from prometheus_client import Counter, Histogram

from .model import Model, event_weight

TOPIC = "openwav.events"

TRAIN_DURATION = Histogram("recommender_train_duration_seconds", "Model training duration",
                           buckets=(0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600))
INTERACTIONS = Counter("recommender_interactions", "Interactions stored from tracking events", ["type"])

log = logging.getLogger("recommender")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "service": "recommender",
            "msg": record.getMessage(),
        }
        payload.update(getattr(record, "extra_fields", {}))
        if record.exc_info:
            payload["err"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=level.upper(), handlers=[handler], force=True)


def _uuid(value) -> Optional[str]:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def _timestamp(value) -> datetime:
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def to_row(event: dict):
    weight = event_weight(event)
    user, media = _uuid(event.get("userId")), _uuid(event.get("mediaId"))
    if weight == 0 or not user or not media:
        return None
    event_id = str(event.get("eventId") or uuid.uuid4())
    return event_id, user, media, weight, _timestamp(event.get("occurredAt"))


class Service:
    def __init__(self, store, model_dir: str, content_weight: float = 0.3, retrain_after: int = 500):
        self.store = store
        self.content_weight = content_weight
        self.retrain_after = retrain_after
        self.model_path = os.path.join(model_dir, "model.npz")
        self._pending = 0
        self._train_lock = threading.Lock()
        self.model = Model.empty(content_weight)
        if os.path.exists(self.model_path):
            try:
                self.model = Model.load(self.model_path, content_weight)
            except Exception:
                log.exception("model load failed, starting empty")

    def train(self) -> bool:
        if not self._train_lock.acquire(blocking=False):
            return False
        try:
            started = time.perf_counter()
            model = Model.train(self.store.load_interactions(), self.store.load_content(), content_weight=self.content_weight)
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            model.save(self.model_path)
            self.model = model
            elapsed = time.perf_counter() - started
            TRAIN_DURATION.observe(elapsed)
            meta = {"users": len(model.users), "items": len(model.items), "seconds": round(elapsed, 3)}
            self.store.save_model(model.version, model.trained_at, meta)
            log.info("model trained", extra={"extra_fields": {"version": model.version, **meta}})
            return True
        finally:
            self._train_lock.release()

    def record(self, events: Iterable[dict]) -> int:
        pairs = [(event, to_row(event)) for event in events]
        rows = [row for _, row in pairs if row]
        stored = self.store.add_interactions(rows)
        for event, row in pairs:
            if row:
                INTERACTIONS.labels(type=event["type"]).inc()
        self._pending += stored
        if self._pending >= self.retrain_after:
            self._pending = 0
            threading.Thread(target=self._safe_train, daemon=True).start()
        return stored

    def _safe_train(self) -> None:
        try:
            self.train()
        except Exception:
            log.exception("training failed")

    def recommend(self, user_id: str, limit: int, exclude: List[str]) -> List[dict]:
        model = self.model
        recent = self.store.recent_media(user_id, model.trained_at) if model.items else []
        return model.recommend(user_id, limit, exclude, recent)

    def similar(self, media_id: str, limit: int, exclude: List[str]) -> List[dict]:
        return self.model.similar(media_id, limit, exclude)


def run_trainer(service: Service, interval: float, stop: threading.Event) -> None:
    if not service.model.items:
        service._safe_train()
    while not stop.wait(interval):
        service._safe_train()


def run_consumer(service: Service, brokers: str, stop: threading.Event) -> None:
    from confluent_kafka import Consumer

    while not stop.is_set():
        consumer = None
        try:
            consumer = Consumer({
                "bootstrap.servers": brokers,
                "group.id": "recommender",
                "auto.offset.reset": "earliest",
                "enable.auto.commit": False,
            })
            consumer.subscribe([TOPIC])
            while not stop.is_set():
                messages = consumer.consume(num_messages=500, timeout=1.0)
                if not messages:
                    continue
                events = []
                for message in messages:
                    if message.error():
                        log.warning("kafka message error", extra={"extra_fields": {"error": str(message.error())}})
                        continue
                    try:
                        events.append(json.loads(message.value()))
                    except (ValueError, TypeError):
                        log.warning("dropping malformed event")
                service.record(events)
                consumer.commit(asynchronous=False)
        except Exception:
            log.exception("consumer failed, restarting in 5s")
            stop.wait(5)
        finally:
            if consumer is not None:
                consumer.close()
