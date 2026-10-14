# OpenWav

OpenWav is a self-hosted YouTube Music clone. You can search YouTube Music, download a track or a whole playlist into your own library, and stream it back through a UI that copies music.youtube.com. Recommendations are personal, every event is tracked Kafka-style, and the stack ships with metrics, traces, logs and latency alerts.

## Quick start

```bash
cp .env.example .env
docker compose up -d --build
```

Open `https://localhost` (self-signed certificate). The first account you register becomes the admin; the admin console is at `/admin`.

## Documentation

| Doc | Contents |
|---|---|
| [Architecture](docs/architecture.md) | Services, data flow, streaming path |
| [Development](docs/development.md) | Local setup, tests, browsing the database |
| [Deployment](docs/deployment.md) | Production, configuration, ops tools, corporate CAs, upgrades |
| [API](docs/api.md) | REST contract |
| [Recommender](docs/recommender.md) | How the recommendation model is built and trained |
| [Auto-discovery](docs/discovery.md) | Scheduled downloads, YouTube cookies, artist images |
| [Event tracking](docs/events.md) | Client events and the Kafka pipeline |
| [Observability](docs/observability.md) | Metrics, alerts, logs, traces |
| [Security](docs/security.md) | Auth, rate limits, secrets, storage access |
