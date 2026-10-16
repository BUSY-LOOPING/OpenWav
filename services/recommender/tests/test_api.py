from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import build_app
from app.service import DEFAULT_PARAMS, Service, resolve_params, to_row

U1, U2, NEW = (f"00000000-0000-0000-0000-00000000000{i}" for i in (1, 2, 3))
A, B, C = (f"00000000-0000-0000-0000-0000000000a{i}" for i in (1, 2, 3))


class FakeStore:
    def __init__(self):
        self.rows = {}
        self.models = []
        self.params = {}

    def ensure_schema(self):
        pass

    def add_interactions(self, rows):
        fresh = [r for r in rows if r[0] not in self.rows]
        self.rows.update({r[0]: r for r in fresh})
        return len(fresh)

    def load_interactions(self, max_age_days=365):
        return [(u, m, w, t) for _, u, m, w, t in self.rows.values()]

    def load_content(self):
        return {A: ["tag:rock"], B: ["tag:rock"], C: ["tag:jazz"]}

    def recent_media(self, user_id, since):
        return [m for _, u, m, w, t in self.rows.values() if u == user_id and w > 0 and (since is None or t > since)]

    def save_model(self, version, trained_at, meta):
        self.models.append((version, meta))

    def load_params(self):
        return self.params

    def recent_models(self, limit=20):
        return [{**meta, "version": version} for version, meta in reversed(self.models)][:limit]

    def data_overview(self):
        return {"totals": {"interactions": len(self.rows)}}


def event(event_id, kind, user, media):
    return {"eventId": event_id, "type": kind, "userId": user, "mediaId": media, "occurredAt": "2026-10-01T00:00:00Z"}


@pytest.fixture
def setup(tmp_path):
    store = FakeStore()
    service = Service(store, str(tmp_path), content_weight=0.3, retrain_after=10_000)
    return store, service, TestClient(build_app(service))


def test_to_row_filters_zero_weight_and_bad_ids():
    assert to_row(event("e", "search", U1, A)) is None
    assert to_row(event("e", "like", "not-a-uuid", A)) is None
    row = to_row(event("e", "like", U1, A))
    assert row[:4] == ("e", U1, A, 5.0)
    assert row[4] == datetime(2026, 10, 1, tzinfo=timezone.utc)


def test_record_is_idempotent_per_event_id(setup):
    store, service, _ = setup
    assert service.record([event("e1", "like", U1, A), event("e2", "search", U1, A)]) == 1
    assert service.record([event("e1", "like", U1, A)]) == 0


def test_empty_model_returns_no_items(setup):
    _, _, client = setup
    assert client.get(f"/recommendations/{U1}").json() == {"items": []}
    assert client.get("/model").json() == {"version": 0, "trainedAt": None, "users": 0, "items": 0}


def test_train_then_recommend_and_similar(setup, tmp_path):
    store, service, client = setup
    service.record([
        event("1", "play_complete", U1, A), event("2", "play_complete", U1, B),
        event("3", "play_complete", U2, A), event("4", "like", U2, C),
    ])
    assert client.post("/train").status_code == 202
    model = client.get("/model").json()
    assert model["users"] == 2 and model["items"] == 3
    assert (tmp_path / "model.npz").exists()
    assert store.models

    items = client.get(f"/recommendations/{U1}", params={"limit": 2, "exclude": C}).json()["items"]
    assert C not in [i["mediaId"] for i in items]
    assert all(set(i) == {"mediaId", "score", "reason"} for i in items)

    cold = client.get(f"/recommendations/{NEW}", params={"limit": 1}).json()["items"]
    assert cold[0]["reason"] == "popular"

    similar = client.get(f"/similar/{A}", params={"limit": 2}).json()["items"]
    assert A not in [i["mediaId"] for i in similar]


def test_model_reloads_from_disk(setup, tmp_path):
    store, service, _ = setup
    service.record([event("1", "like", U1, A)])
    service.train()
    reloaded = Service(store, str(tmp_path))
    assert reloaded.model.version == service.model.version


def test_validation_health_and_metrics(setup):
    _, _, client = setup
    assert client.get("/recommendations/not-a-uuid").status_code == 422
    assert client.get(f"/recommendations/{U1}", params={"limit": 0}).status_code == 422
    assert client.get("/health").json()["status"] == "ok"
    body = client.get("/metrics").text
    assert 'http_request_duration_seconds_bucket{le="0.005",method="GET",route="/health",status="200"}' in body
    assert "recommender_interactions_total" in body


def test_resolve_params_clamps_and_ignores_bad_types():
    params = resolve_params({"recommender.factors": 9999, "recommender.iterations": True, "recommender.regularization": "x",
                             "recommender.blend_content_weight": -1, "recommender.alpha": 12.5})
    assert params["factors"] == 256
    assert params["iterations"] == DEFAULT_PARAMS["iterations"]
    assert params["reg"] == DEFAULT_PARAMS["reg"]
    assert params["content_weight"] == 0.0
    assert params["alpha"] == 12.5


def test_training_uses_stored_params_and_reports_insights(setup, tmp_path):
    store, service, client = setup
    store.params = {"recommender.iterations": 3, "recommender.factors": 4, "recommender.blend_content_weight": 0.6}
    service.record([event("1", "play_complete", U1, A), event("2", "like", U2, B), event("3", "like", U2, A)])
    assert service.train()

    _, meta = store.models[-1]
    assert meta["params"]["iterations"] == 3 and meta["params"]["factors"] == 4
    assert len(meta["loss"]) == 3 and meta["loss"][-1] <= meta["loss"][0]
    assert meta["interactions"] == 3 and 0 < meta["density"] <= 1
    assert service.model.user_factors.shape[1] == 4
    assert Service(store, str(tmp_path)).model.content_weight == 0.6

    body = client.get("/insights").json()
    assert body["status"]["state"] == "idle" and body["status"]["iteration"] == 3
    assert body["model"]["users"] == 2
    assert body["params"]["content_weight"] == 0.6
    assert body["runs"][0]["loss"] == meta["loss"]
    assert body["data"]["totals"]["interactions"] == 3


def test_failed_training_is_reported(setup):
    store, service, client = setup
    store.load_content = lambda: (_ for _ in ()).throw(RuntimeError("db down"))
    service._safe_train()
    status = client.get("/insights").json()["status"]
    assert status["state"] == "failed" and status["error"] == "db down"
