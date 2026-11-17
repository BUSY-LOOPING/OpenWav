# Observability and alerts

## Observability and alerts

- **Metrics:** every service exposes `http_request_duration_seconds` labelled by `service`. Workers add job counters and durations. Postgres, Redis, RabbitMQ, Redpanda and nginx have exporters. `node-exporter` reports host CPU, memory, swap, network and free space on every disk.
- **Alerts** (`infra/observability/prometheus/alerts.yml`):

  | Alert | Fires when |
  |---|---|
  | `HighLatencyP95` | P95 above 500 ms for 5 minutes |
  | `HighLatencyP99` | P99 above 1.5 s for 5 minutes |
  | `HighErrorRate` | 5xx responses above 5% |
  | `ServiceDown` | a service is down |
  | `DownloadQueueBacklog` | the download queue is backed up |
  | `DownloadFailureRate` | too many downloads fail |
  | `RecommenderStale` | no recommender retrain in 2 hours |
  | `DiskSpaceLow` | a disk has under 10% free for 10 minutes |
  | `MemoryPressure` | under 10% of host memory available for 10 minutes |

  Alertmanager routes them to whichever receivers are configured.
- **Traces:** OpenTelemetry auto-instrumentation sends traces to Tempo. Request ids flow from nginx into the logs.
- **Logs:** pino and Python JSON logs, collected by Promtail into Loki.
- **Grafana:** the "OpenWav Overview" dashboard is provisioned automatically.
- **Admin console:**
  - **Dashboard:** host CPU, memory, swap, network and uptime, hot (SSD) and cold (`COLD_STORAGE_DIR`) storage, and history graphs (1 h to 7 d) for host load, network, disk use, downloads, API traffic and P95.
  - **Analytics:** plays, listeners, downloads and sign-ups per day; top tracks, artists and listeners; searches that found nothing.
  - **Jobs & queues:** queue depths, a pause switch for all downloads, dead-letter inspect, replay and purge, scheduled job outcomes, and yt-dlp health (version, latest release, 24 h success rate, common errors) with an in-place update.
  - **Storage:** tiers, library size by format, largest tracks, and the cleanup policy with a preview.
  - **Scraper:** health, cache hit rate, upstream errors, per-endpoint traffic, live settings (cache time, timeout, parallelism, retries) and a console to call any endpoint and inspect its output.
  - **Users:** storage use, per-user limits (downloading on or off, daily limit, maximum quality, storage) and signed-in devices with sign-out.
  - **Audit log:** every admin change, with who made it and from where.
  - **Traces** lists recent Tempo traces with links into Grafana. **Logs** tails Loki by service, text and errors only.
- Deploys send Prometheus `SIGHUP` so changes to scrape jobs and alert rules apply without a restart.

## Storage quotas and download concurrency

- **Settings → Storage** sets the default per-user quota in GB (0 means unlimited). **Users** shows what each user has downloaded and can override their limit. Once a user is over their limit, new downloads fail with "Storage limit reached". Tracks they already have stay.
- **Settings → Downloads → Concurrent downloads** (default 3) sets how many downloads each downloader runs at once. Changes apply within 15 seconds without a restart.
- **Storage cleanup** (off by default) removes tracks older than the window that nobody liked, playlisted or played within it, once a day, up to 500 per run.
- Play events and missed searches are kept for `analytics.retention_days` (default 365).
- Only one copy of a track downloads at a time. A second request for the same track waits until the first finishes, then links the stored file.
