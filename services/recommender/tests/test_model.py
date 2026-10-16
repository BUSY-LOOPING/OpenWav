from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from app.model import Model, als, blend, build_matrix, decay, event_weight, minmax, rank, tfidf, tokens_for

NOW = datetime(2026, 10, 1, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    "event,expected",
    [
        ({"type": "play_complete"}, 3.0),
        ({"type": "play_start"}, 1.0),
        ({"type": "like"}, 5.0),
        ({"type": "unlike"}, -5.0),
        ({"type": "add_to_playlist"}, 4.0),
        ({"type": "skip", "positionSec": 12}, -1.0),
        ({"type": "skip", "positionSec": 45}, 0.0),
        ({"type": "skip"}, 0.0),
        ({"type": "search"}, 0.0),
        ({"type": "page_view"}, 0.0),
    ],
)
def test_event_weight(event, expected):
    assert event_weight(event) == expected


def test_decay_halves_every_half_life():
    assert decay(0) == 1.0
    assert decay(30) == pytest.approx(0.5)
    assert decay(60) == pytest.approx(0.25)
    assert decay(-5) == 1.0


def test_build_matrix_sums_decayed_weights_and_keeps_catalog_items():
    users, items, matrix = build_matrix(
        [("u1", "a", 3.0, NOW), ("u1", "a", 1.0, NOW - timedelta(days=30)), ("u2", "b", -1.0, NOW)],
        NOW,
        catalog=["c"],
    )
    assert users == ["u1", "u2"]
    assert items == ["c", "a", "b"]
    assert matrix[0, 1] == pytest.approx(3.5)
    assert matrix[1, 2] == pytest.approx(-1.0)
    assert np.isnan(matrix[0, 0])


def _clustered():
    interactions = []
    for user in ("u1", "u2", "u3"):
        interactions += [(user, m, 3.0, NOW) for m in ("a1", "a2", "a3")]
    for user in ("u4", "u5", "u6"):
        interactions += [(user, m, 3.0, NOW) for m in ("b1", "b2", "b3")]
    interactions += [("new", "a1", 3.0, NOW), ("new", "a2", 3.0, NOW)]
    return interactions


def test_als_recovers_co_listening_structure():
    users, items, matrix = build_matrix(_clustered(), NOW)
    user_factors, item_factors = als(matrix, factors=4, iterations=15)
    scores = item_factors @ user_factors[users.index("new")]
    assert scores[items.index("a3")] > max(scores[items.index(b)] for b in ("b1", "b2", "b3"))


def test_als_reports_decreasing_loss_each_iteration():
    _, _, matrix = build_matrix(_clustered(), NOW)
    losses = []
    als(matrix, factors=4, iterations=5, on_iteration=lambda i, loss: losses.append((i, loss)))
    assert [i for i, _ in losses] == [1, 2, 3, 4, 5]
    assert losses[-1][1] < losses[0][1]


def test_trained_model_recommends_missing_cluster_item_first():
    model = Model.train(_clustered(), {}, now=NOW, factors=4, iterations=15, content_weight=0.0)
    top = model.recommend("new", limit=1)
    assert top[0]["mediaId"] == "a3"
    assert top[0]["reason"] == "cf"


def test_tfidf_rows_are_unit_length_and_similar_items_score_higher():
    features = tfidf({"x": ["tag:rock", "artist:1"], "y": ["tag:rock", "artist:1"], "z": ["tag:jazz"]}, ["x", "y", "z", "empty"])
    assert np.linalg.norm(features[0]) == pytest.approx(1.0)
    assert np.linalg.norm(features[3]) == 0
    assert features[0] @ features[1] > features[0] @ features[2]


def test_tokens_for_normalises_tags():
    assert tokens_for([" Rock ", "", "Pop"], ["a1"]) == ["tag:rock", "tag:pop", "artist:a1"]


def test_minmax_handles_constant_and_empty():
    assert minmax(np.array([2.0, 2.0])).tolist() == [0.0, 0.0]
    assert minmax(np.array([1.0, 3.0])).tolist() == [0.0, 1.0]
    assert minmax(np.array([])).size == 0


def test_blend_weights_and_reasons():
    scores, reasons = blend(np.array([1.0, 0.0]), np.array([0.0, 1.0]), 0.3)
    assert scores.tolist() == pytest.approx([0.7, 0.3])
    assert reasons == ["cf", "content"]


def test_rank_excludes_and_prefers_unheard_then_backfills():
    scores = np.array([0.9, 0.8, 0.7, 0.6])
    reasons = ["cf"] * 4
    assert [i for i, _, _ in rank(scores, reasons, 2, exclude={1}, heard={0})] == [2, 3]
    assert [i for i, _, _ in rank(scores, reasons, 3, exclude={1}, heard={0})] == [2, 3, 0]


def test_cold_start_uses_recent_history_content_then_popularity():
    tokens = {"a1": ["tag:rock"], "a2": ["tag:rock"], "b1": ["tag:jazz"], "b2": ["tag:jazz"]}
    interactions = [("u1", "b1", 5.0, NOW), ("u2", "b1", 5.0, NOW), ("u2", "b2", 3.0, NOW)]
    model = Model.train(interactions, tokens, now=NOW, factors=4)
    by_content = model.recommend("stranger", limit=1, recent=["a1"])
    assert by_content[0] == {"mediaId": "a2", "score": pytest.approx(1.0), "reason": "content"}
    by_popularity = model.recommend("stranger", limit=2)
    assert [r["mediaId"] for r in by_popularity] == ["b1", "b2"]
    assert {r["reason"] for r in by_popularity} == {"popular"}


def test_recommend_honours_explicit_exclude_and_empty_model():
    model = Model.train(_clustered(), {}, now=NOW, factors=4, iterations=15)
    assert "a3" not in [r["mediaId"] for r in model.recommend("new", limit=5, exclude=["a3"])]
    assert Model.empty().recommend("anyone") == []


def test_similar_excludes_seed_and_finds_cluster_mates():
    model = Model.train(_clustered(), {}, now=NOW, factors=4, iterations=15)
    similar = [r["mediaId"] for r in model.similar("a1", limit=2)]
    assert "a1" not in similar
    assert set(similar) <= {"a2", "a3"}
    assert len(model.similar("unknown", limit=3)) == 3


def test_save_and_load_round_trip(tmp_path):
    model = Model.train(_clustered(), {"a1": ["tag:x"]}, now=NOW, factors=4)
    path = str(tmp_path / "model.npz")
    model.save(path)
    loaded = Model.load(path)
    assert loaded.version == model.version
    assert loaded.trained_at == model.trained_at
    assert loaded.heard == model.heard
    assert loaded.recommend("new", limit=3) == model.recommend("new", limit=3)
