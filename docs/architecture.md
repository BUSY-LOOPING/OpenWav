# Architecture

## Architecture

```
                      ┌──────────────────────── nginx (HTTP/2, TLS) ────────────────────────┐
 browser ──h2──────▶  │ /            SPA (immutable assets)                                 │
                      │ /api/v1/*    ─────────────▶ backend (Express 5, Prisma)              │
                      │ /stream/*    secure_link ─▶ slice 1m + proxy_cache ─▶ RustFS (audio) │
                      │ /covers/*    proxy_cache ──────────────────────────▶ RustFS (covers) │
                      └──────────────────────────────────────────────────────────────────────┘
 backend ──AMQP──▶ RabbitMQ ──▶ downloader (yt-dlp via spawn, Prisma, AWS S3 SDK) ──▶ RustFS
    │ ▲                │ retry queue (exponential backoff) · dead-letter queue
    │ └── Redis pub/sub (progress → SSE, cancel signals) · rate limits · caches
    ├──Kafka (Redpanda) openwav.events ──▶ recommender (FastAPI, numpy ALS + content) ──┐
    ├──HTTP /recommendations, /similar ◀─────────────────────────────────────────────────┘
    └──HTTP /search, /suggestions ──▶ scraper (FastAPI, ytmusicapi + yt-dlp fallback)
 scheduler (node-cron) ──▶ stale-task recovery, pruning, Kafka retention sync
 Prometheus ◀── /metrics everywhere ──▶ Alertmanager (P95/P99/errors/queue/down) · Grafana · Tempo · Loki
```

Audio never passes through Express. The API returns a short-lived URL signed with an HMAC. nginx checks the signature with `secure_link`, splits the file into 1 MB `Range` slices, caches them on local disk, and serves them with `sendfile`. Seeking starts as soon as the requested slice is cached, and covers and tracks load in parallel over a single HTTP/2 connection.

## Services

| Path | Language | Responsibility |
|---|---|---|
| `backend/` | Node 22, Express 5, Prisma | REST API (`docs/api.md`): auth, browse, search, library, playlists, downloads, events, admin |
| `services/downloader/` | Node, Prisma, AWS S3 SDK | Consumes jobs, runs `yt-dlp` with `spawn` and streams progress, normalises loudness, uploads audio and covers, links artists, albums and playlists |
| `services/scheduler/` | Node, Prisma, kafkajs | Re-queues stuck jobs, prunes tokens and old tasks, applies the admin event-retention setting to the topic, and runs auto-discovery |
| `services/recommender/` | Python, FastAPI, numpy | Implicit-feedback ALS with time decay, blended with TF-IDF tag and artist similarity; popularity fallback for cold start |
| `services/scraper/` | Python, FastAPI, ytmusicapi | Searches and suggests from music.youtube.com with caching and polite retries; no YouTube API key |
| `frontend/` | React 19, Vite, Tailwind 4 | YouTube Music UI, responsive to 320 px, admin console |
| `packages/db/` | Prisma 7 | Single schema, migrations, test database helper |
| `packages/shared/` | JS | Queue topology, job and event schemas, statuses, default settings, logger, metrics, tracing |
| `infra/` | | nginx, Prometheus rules, Alertmanager, Grafana dashboards, Tempo, Loki, Redpanda init, smoke test |

Storage is **RustFS**. Every service reaches it through `@aws-sdk/client-s3` in path-style mode.
