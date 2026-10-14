# Deployment

## Production

```bash
cp .env.example .env
docker compose up -d --build
infra/scripts/smoke.sh
```

Behind a TLS-inspecting corporate proxy, put its root CA files (`*.crt`, PEM) in `infra/certs/`, which is gitignored. Every image adds them to its trust store at build time and at runtime, for apk, apt, npm, pip, requests, httpx and yt-dlp. On macOS: `security find-certificate -a -p -c "<CA name>" /Library/Keychains/System.keychain > infra/certs/corp.crt`.

Only nginx (80/443) is published publicly; the ops tools listed below bind to `127.0.0.1`. The `migrate` job runs `prisma migrate deploy` before the backend starts. `smoke.sh` checks that HTTP/2 is negotiated, that unsigned and expired stream URLs are rejected, and that a signed Range request returns `206`.

### Upgrading a database from the old node-pg-migrate schema

```bash
npx prisma migrate resolve --applied 0_init
npx prisma migrate deploy
```

Run both from `packages/db/`. `1_prisma_upgrade` converts the tables in place and loses no data. It merges duplicate media and moves their likes, history and playlist entries onto the copy it keeps. It also rolls history up to one row per user and track, converts statuses to enums, and moves settings into jsonb.

## Configuration

`.env.example` lists every variable. The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, `KAFKA_BROKERS` | Infrastructure |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_AUDIO`, `S3_BUCKET_COVERS` | RustFS |
| `PUBLIC_BASE_URL`, `STREAM_SIGNING_SECRET`, `STREAM_URL_TTL_SEC` | Signed stream URLs (the secret is shared with nginx) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS` | Auth (refresh tokens rotate, and reusing one revokes all of that user's tokens) |
| `SCRAPER_URL`, `RECOMMENDER_URL` | Internal services |
| `PROMETHEUS_URL`, `ALERTMANAGER_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT` | Observability |
| `ALERT_WEBHOOK_URL`, `ALERT_SLACK_WEBHOOK_URL`, `ALERT_EMAIL_TO`, `SMTP_*` | Alert receivers (set any of them) |

Admins edit runtime settings from **Admin → Settings**, and they take effect within 10 seconds without a restart: download limits and allowed domains, registration, rate limits (global, auth, downloads), event tracking (on/off, per event type, sample rate, retention), the recommender (on/off, content weight, retrain) and the alert thresholds.

## Ops tools

Grafana (`127.0.0.1:3001`), Prometheus (`:9090`), Alertmanager (`:9093`) and the RabbitMQ console (`:15672`) are published on loopback only, so they are reachable from the host or over an SSH tunnel or VPN, never publicly. **Admin → Dashboard → Monitoring tools** links to each one, with a deep link to the OpenWav Grafana dashboard. Behind a real domain, set `OPS_GRAFANA_URL`, `OPS_PROMETHEUS_URL`, `OPS_ALERTMANAGER_URL` and `OPS_RABBITMQ_URL` to wherever you expose them (ideally behind SSO).

## Rebuilding after changes

`docker compose up -d --build <service>` only recreates the services you name (and their dependencies). After changing ports or environment for Prometheus, Alertmanager or Grafana, include them explicitly. To rebuild everything, run `docker compose up -d --build`.
