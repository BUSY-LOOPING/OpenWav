# Recommender

`services/recommender` is a FastAPI service built on numpy, with no ML framework. It powers Home "Quick picks" (`GET /recommendations/{userId}`) and the player's Related tab (`GET /similar/{mediaId}`). When it is down, the backend falls back to popularity and same-artist tracks.

## Data flow

```
browser ──POST /api/v1/events──▶ backend ──Kafka openwav.events──▶ recommender consumer
                                                                       │ weight each event
                                                                       ▼
                                                     recsys.interactions (Postgres)
                                                                       │ every 15 min or 500 new rows
                                                                       ▼
                                          train: ALS + TF-IDF ──▶ MODEL_DIR/model.npz (atomic replace)
```

1. **Collect.** The consumer (group `recommender`, offsets committed only after the rows are stored) turns each tracking event into an interaction `(eventId, user, media, weight, occurredAt)`. Events with zero weight are dropped.
2. **Store.** Interactions are written to `recsys.interactions`, keyed by event id, so a replayed Kafka message isn't counted twice. Training reads the last 365 days.
3. **Train** on a timer (`RECOMMENDER_TRAIN_INTERVAL_SEC`: 900 s in code, 1800 s in `docker-compose.yml`), after `RECOMMENDER_TRAIN_AFTER_EVENTS` (500) new interactions, on startup if no model exists yet, or from **Admin → Settings → Retrain**. A lock ensures only one training runs at a time.
4. **Serve.** The new model is saved to `model.npz` through a temp file and `os.replace`, then swapped in memory. Requests keep using the old model until the swap, and a restart reloads the file.

## Event weights

| Event | Weight |
|---|---|
| `like` | +5 |
| `add_to_playlist` | +4 |
| `play_complete` | +3 |
| `play_start` | +1 |
| `skip` before 30 s | −1 (later skips 0) |
| `unlike` | −5 |

Each weight is multiplied by `0.5 ^ (age_days / 30)`, a 30-day half-life, and summed per (user, track). The result is a user × track matrix where an empty cell means "never interacted".

## Model 1: collaborative filtering (implicit ALS)

This is the implicit-feedback matrix factorisation of Hu, Koren and Volinsky (2008):

- **Preference** `p = 1` where the summed weight is above 0, otherwise `0`. Negative totals are treated as "not preferred".
- **Confidence** `c = 1 + 40 · max(weight, 0)`. A track played and liked often is a confident positive; an unheard track is a weak negative.
- It learns 32 latent factors per user (`U`) and per track (`V`) so that `U·Vᵀ ≈ p`, weighted by `c`, with L2 regularisation `0.1`.
- **Alternating least squares:** fix `V` and solve each user's factors exactly with one linear solve, `(VᵀV + Vᵀ(Cᵤ−I)V + λI)·u = VᵀCᵤ·pᵤ`. Then fix `U` and do the same for every track. Ten passes, with a fixed random seed so results are reproducible. If the numbers diverge, training fails and the previous model stays live.

The score for user *u* and track *i* is `U[u] · V[i]`. In effect, "listeners who play what you play also play this".

## Model 2: content similarity (TF-IDF)

Each completed track gets tokens `tag:<tag>` (from yt-dlp metadata) and `artist:<id>`. Tokens are one-hot encoded, weighted by inverse document frequency (a rare tag such as `amapiano` counts more than `pop`) and L2-normalised. A user's taste profile is the sum of the vectors of the tracks they liked plus anything they have played since the last training run. The content score is the cosine similarity of each track to that profile.

This covers what ALS can't: brand-new tracks with no plays yet, and listening the model hasn't been retrained on.

## Blending and ranking

Both scores are min-max scaled to 0–1 and blended:

```
score = (1 − w) · ALS + w · content          w = recommender.blend_content_weight (Admin → Settings, default 0.3)
```

Each result carries a `reason`: `cf` or `content`, whichever part contributed more. Ranking drops excluded ids, puts unheard tracks first, and only fills with already-heard tracks if there aren't enough new ones.

| Situation | Strategy |
|---|---|
| User is in the trained model | ALS + content blend |
| New user who has played something since the last training | Content only, from recent plays |
| Nothing known | Popularity (sum of positive weights per track) |
| `/similar` for a known track | Cosine of ALS item vectors blended with content cosine |
| `/similar` for an unknown track | Popularity |

## Tuning

The factor count, regularisation, iteration count, confidence alpha, decay half-life, training window and content weight are settings under **Admin → Settings → Recommendations** (`recommender.*` keys). The recommender reads them at the start of each training run and clamps them to safe ranges, so a change takes effect on the next retrain. `RECOMMENDER_CONTENT_WEIGHT` is only the fallback for when no setting is stored.

## Cost and limits

Training is dense numpy: memory is O(users × tracks), and each pass solves one small 32 × 32 system per user and per track. That is fine for thousands of users and tens of thousands of tracks on one CPU core, and the training time is exported as `recommender_train_duration_seconds`. Beyond that, replace `als()` with a sparse implementation such as the `implicit` library; the interface (`Model.train`, `recommend`, `similar`, `save`, `load`) stays the same.

## Observability

| Signal | What it is |
|---|---|
| `recommender_train_duration_seconds` | Training time histogram |
| `recommender_interactions{type}` | Interactions stored, by event type |
| `RecommenderStale` alert | No retrain in 2 hours |
| `recsys.models` | One row per trained version: users, items, interactions, density, params, per-iteration loss, seconds |
| `GET /insights` | Live training state and loss, current params, recent runs, and a data overview (totals, event mix, daily counts, top tracks, latest interactions) |
| **Admin → Recommender** | The page for all of the above. It polls every 1.5 s while training |
| Logs | A `model trained` line with the version and counts |
