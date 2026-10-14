import os
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

import numpy as np

EVENT_WEIGHTS = {"play_complete": 3.0, "play_start": 1.0, "like": 5.0, "unlike": -5.0, "add_to_playlist": 4.0}
HALF_LIFE_DAYS = 30.0
SKIP_THRESHOLD_SEC = 30

Interaction = Tuple[str, str, float, datetime]


def event_weight(event: dict) -> float:
    kind = event.get("type")
    if kind == "skip":
        position = event.get("positionSec")
        return -1.0 if position is not None and position < SKIP_THRESHOLD_SEC else 0.0
    return EVENT_WEIGHTS.get(kind, 0.0)


def decay(age_days: float, half_life_days: float = HALF_LIFE_DAYS) -> float:
    return 0.5 ** (max(age_days, 0.0) / half_life_days)


def build_matrix(
    interactions: Iterable[Interaction],
    now: datetime,
    catalog: Sequence[str] = (),
    half_life_days: float = HALF_LIFE_DAYS,
) -> Tuple[List[str], List[str], np.ndarray]:
    users: Dict[str, int] = {}
    items: Dict[str, int] = {item: i for i, item in enumerate(dict.fromkeys(catalog))}
    cells: Dict[Tuple[int, int], float] = {}
    for user, media, weight, occurred_at in interactions:
        u = users.setdefault(user, len(users))
        i = items.setdefault(media, len(items))
        age = (now - occurred_at).total_seconds() / 86400
        cells[(u, i)] = cells.get((u, i), 0.0) + weight * decay(age, half_life_days)
    matrix = np.full((len(users), len(items)), np.nan)
    for (u, i), value in cells.items():
        matrix[u, i] = value
    return list(users), list(items), matrix


def als(
    weights: np.ndarray,
    factors: int = 32,
    reg: float = 0.1,
    iterations: int = 10,
    alpha: float = 40.0,
    seed: int = 0,
) -> Tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    n_users, n_items = weights.shape
    positive = np.clip(np.nan_to_num(weights), 0, None)
    preference = (positive > 0).astype(float)
    confidence = 1.0 + alpha * positive
    user_factors = rng.normal(scale=0.1, size=(n_users, factors))
    item_factors = rng.normal(scale=0.1, size=(n_items, factors))
    with np.errstate(all="ignore"):
        for _ in range(iterations):
            user_factors = _solve(item_factors, confidence, preference, reg)
            item_factors = _solve(user_factors, confidence.T, preference.T, reg)
    if not (np.isfinite(user_factors).all() and np.isfinite(item_factors).all()):
        raise FloatingPointError("ALS diverged")
    return user_factors, item_factors


def _solve(fixed: np.ndarray, confidence: np.ndarray, preference: np.ndarray, reg: float) -> np.ndarray:
    k = fixed.shape[1]
    gram = fixed.T @ fixed
    out = np.empty((confidence.shape[0], k))
    for row in range(confidence.shape[0]):
        c = confidence[row]
        a = gram + (fixed.T * (c - 1.0)) @ fixed + reg * np.eye(k)
        b = (fixed.T * c) @ preference[row]
        out[row] = np.linalg.solve(a, b)
    return out


def unit_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return np.divide(matrix, norms, out=np.zeros_like(matrix, dtype=float), where=norms > 0)


def tfidf(item_tokens: Dict[str, List[str]], items: Sequence[str]) -> np.ndarray:
    vocab: Dict[str, int] = {}
    for item in items:
        for token in set(item_tokens.get(item, ())):
            vocab.setdefault(token, len(vocab))
    features = np.zeros((len(items), len(vocab)))
    for row, item in enumerate(items):
        for token in set(item_tokens.get(item, ())):
            features[row, vocab[token]] = 1.0
    idf = np.log((1 + len(items)) / (1 + features.sum(axis=0))) + 1.0
    return unit_rows(features * idf)


def minmax(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values
    low, high = float(values.min()), float(values.max())
    return (values - low) / (high - low) if high > low else np.zeros_like(values, dtype=float)


def blend(cf: np.ndarray, content: np.ndarray, content_weight: float) -> Tuple[np.ndarray, List[str]]:
    cf_part = (1.0 - content_weight) * cf
    content_part = content_weight * content
    reasons = ["content" if c > f else "cf" for f, c in zip(cf_part, content_part)]
    return cf_part + content_part, reasons


def rank(
    scores: np.ndarray,
    reasons: Sequence[str],
    limit: int,
    exclude: Set[int] = frozenset(),
    heard: Set[int] = frozenset(),
) -> List[Tuple[int, float, str]]:
    order = [int(i) for i in np.argsort(-scores, kind="stable") if int(i) not in exclude]
    fresh = [i for i in order if i not in heard]
    picked = fresh[:limit]
    if len(picked) < limit:
        picked += [i for i in order if i in heard][: limit - len(picked)]
    return [(i, float(scores[i]), reasons[i]) for i in picked]


def tokens_for(tags: Iterable[str], artist_ids: Iterable[str]) -> List[str]:
    return [f"tag:{t.strip().lower()}" for t in tags if t and t.strip()] + [f"artist:{a}" for a in artist_ids if a]


class Model:
    def __init__(
        self,
        users: List[str],
        items: List[str],
        user_factors: np.ndarray,
        item_factors: np.ndarray,
        features: np.ndarray,
        popularity: np.ndarray,
        heard: Dict[str, Set[int]],
        liked: Dict[str, Set[int]],
        version: int,
        trained_at: Optional[datetime],
        content_weight: float = 0.3,
    ):
        self.users = users
        self.items = items
        self.user_factors = user_factors
        self.item_factors = item_factors
        self.features = features
        self.popularity = popularity
        self.heard = heard
        self.liked = liked
        self.version = version
        self.trained_at = trained_at
        self.content_weight = content_weight
        self._user_index = {u: i for i, u in enumerate(users)}
        self._item_index = {m: i for i, m in enumerate(items)}

    @classmethod
    def empty(cls, content_weight: float = 0.3) -> "Model":
        return cls([], [], np.zeros((0, 1)), np.zeros((0, 1)), np.zeros((0, 0)), np.zeros(0), {}, {}, 0, None, content_weight)

    @classmethod
    def train(
        cls,
        interactions: Iterable[Interaction],
        item_tokens: Dict[str, List[str]],
        now: Optional[datetime] = None,
        content_weight: float = 0.3,
        factors: int = 32,
        reg: float = 0.1,
        iterations: int = 10,
    ) -> "Model":
        now = now or datetime.now(timezone.utc)
        users, items, matrix = build_matrix(interactions, now, catalog=list(item_tokens))
        if users:
            user_factors, item_factors = als(matrix, factors=factors, reg=reg, iterations=iterations)
        else:
            user_factors, item_factors = np.zeros((0, factors)), np.zeros((len(items), factors))
        heard = {u: set(np.flatnonzero(~np.isnan(matrix[row])).tolist()) for row, u in enumerate(users)}
        liked = {u: set(np.flatnonzero(np.nan_to_num(matrix[row]) > 0).tolist()) for row, u in enumerate(users)}
        popularity = minmax(np.clip(np.nan_to_num(matrix), 0, None).sum(axis=0)) if users else np.zeros(len(items))
        return cls(users, items, user_factors, item_factors, tfidf(item_tokens, items), popularity, heard, liked,
                   int(now.timestamp()), now, content_weight)

    def _content_from(self, indices: Iterable[int]) -> np.ndarray:
        indices = list(indices)
        if not indices or self.features.shape[1] == 0:
            return np.zeros(len(self.items))
        profile = self.features[indices].sum(axis=0)
        return minmax(self.features @ profile)

    def _indices(self, media_ids: Iterable[str]) -> Set[int]:
        return {self._item_index[m] for m in media_ids if m in self._item_index}

    def _result(self, ranked: List[Tuple[int, float, str]]) -> List[dict]:
        return [{"mediaId": self.items[i], "score": round(score, 6), "reason": reason} for i, score, reason in ranked]

    def recommend(self, user: str, limit: int = 20, exclude: Iterable[str] = (), recent: Iterable[str] = ()) -> List[dict]:
        if not self.items:
            return []
        excluded = self._indices(exclude)
        recent_idx = self._indices(recent)
        row = self._user_index.get(user)
        heard = self.heard.get(user, set()) | recent_idx
        if row is not None:
            cf = minmax(self.item_factors @ self.user_factors[row])
            content = self._content_from(self.liked.get(user, set()) | recent_idx)
            scores, reasons = blend(cf, content, self.content_weight)
        elif recent_idx and self.features.shape[1] > 0:
            scores = self._content_from(recent_idx)
            reasons = ["content"] * len(self.items)
        else:
            scores, reasons = self.popularity, ["popular"] * len(self.items)
        return self._result(rank(scores, reasons, limit, excluded, heard))

    def similar(self, media: str, limit: int = 20, exclude: Iterable[str] = ()) -> List[dict]:
        index = self._item_index.get(media)
        if index is None:
            return self._result(rank(self.popularity, ["popular"] * len(self.items), limit, self._indices(exclude)))
        normalized = unit_rows(self.item_factors)
        cf = minmax(normalized @ normalized[index])
        content = minmax(self.features @ self.features[index]) if self.features.shape[1] else np.zeros(len(self.items))
        scores, reasons = blend(cf, content, self.content_weight)
        return self._result(rank(scores, reasons, limit, self._indices(exclude) | {index}))

    def save(self, path: str) -> None:
        pairs = lambda groups: np.array([(self._user_index[u], i) for u, idx in groups.items() for i in idx], dtype=np.int64).reshape(-1, 2)
        tmp = f"{path}.tmp.npz"
        np.savez_compressed(
            tmp,
            users=np.array(self.users, dtype=str),
            items=np.array(self.items, dtype=str),
            user_factors=self.user_factors,
            item_factors=self.item_factors,
            features=self.features,
            popularity=self.popularity,
            heard=pairs(self.heard),
            liked=pairs(self.liked),
            meta=np.array([self.version, self.trained_at.timestamp() if self.trained_at else 0.0]),
        )
        os.replace(tmp, path)

    @classmethod
    def load(cls, path: str, content_weight: float = 0.3) -> "Model":
        data = np.load(path, allow_pickle=False)
        users = data["users"].tolist()
        def groups(pairs: np.ndarray) -> Dict[str, Set[int]]:
            grouped: Dict[str, Set[int]] = {u: set() for u in users}
            for row, item in pairs:
                grouped[users[int(row)]].add(int(item))
            return grouped

        version, trained = data["meta"]
        return cls(users, data["items"].tolist(), data["user_factors"], data["item_factors"], data["features"],
                   data["popularity"], groups(data["heard"]), groups(data["liked"]), int(version),
                   datetime.fromtimestamp(trained, timezone.utc) if trained else None, content_weight)
