# Deployment

## Production

```bash
cp .env.example .env
docker compose up -d --build
infra/scripts/smoke.sh
```

Behind a TLS-inspecting corporate proxy, put its root CA files (`*.crt`, PEM) in `infra/certs/`, which is gitignored. Every image adds them to its trust store at build time and at runtime, for apk, apt, npm, pip, requests, httpx and yt-dlp. On macOS: `security find-certificate -a -p -c "<CA name>" /Library/Keychains/System.keychain > infra/certs/corp.crt`.

Only nginx (80/443) is published publicly. The ops tools are served through it under sub-paths (see below). The `migrate` job runs `prisma migrate deploy` before the backend starts. `smoke.sh` checks that HTTP/2 is negotiated, that unsigned and expired stream URLs are rejected, and that a signed Range request returns `206`.

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

nginx serves the ops tools on the main domain, so a single tunnel or proxy route to port 443 covers them:

| Tool | URL | Login |
|---|---|---|
| Grafana | `$PUBLIC_BASE_URL/grafana/` | `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` |
| RabbitMQ console | `$PUBLIC_BASE_URL/rabbitmq/` | `RABBITMQ_USER` / `RABBITMQ_PASSWORD` |
| Prometheus | `$PUBLIC_BASE_URL/prometheus/` | `OPS_USER` / `OPS_PASSWORD` (nginx basic auth) |
| Alertmanager | `$PUBLIC_BASE_URL/alertmanager/` | `OPS_USER` / `OPS_PASSWORD` (nginx basic auth) |
| Prisma Studio | `https://studio.<your domain>/` | `OPS_USER` / `OPS_PASSWORD` (nginx basic auth) |

Prisma Studio loads its assets from absolute paths, so nginx serves it on any hostname starting with `studio.` (`https://studio.localhost` locally); add a tunnel route for that hostname to the same port 443 and set `OPS_PRISMA_STUDIO_URL` to it. Studio can edit every row, so treat its password like the database password. Prometheus, Alertmanager and Studio stay locked until `OPS_PASSWORD` is set. They are also still published on loopback (`127.0.0.1:9090`, `:9093`), and Grafana and RabbitMQ are reachable there under their sub-paths (`127.0.0.1:3001/grafana/`, `127.0.0.1:15672/rabbitmq/`). **Admin → Dashboard → Monitoring tools** links to the public URLs by default. Set `OPS_GRAFANA_URL`, `OPS_PROMETHEUS_URL`, `OPS_ALERTMANAGER_URL` or `OPS_RABBITMQ_URL` to override them. For anything internet-facing, also put the paths behind SSO such as Cloudflare Access.

## Rebuilding after changes

`docker compose up -d --build <service>` only recreates the services you name (and their dependencies). After changing ports or environment for Prometheus, Alertmanager or Grafana, include them explicitly. To rebuild everything, run `docker compose up -d --build`.
