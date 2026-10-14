# Observability and alerts

## Observability and alerts

- **Metrics:** every service exposes `http_request_duration_seconds` labelled by `service`. Workers add job counters and durations. Postgres, Redis, RabbitMQ, Redpanda and nginx have exporters.
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

  Alertmanager routes them to whichever receivers are configured.
- **Traces:** OpenTelemetry auto-instrumentation sends traces to Tempo. Request ids flow from nginx into the logs.
- **Logs:** pino and Python JSON logs, collected by Promtail into Loki.
- **Grafana:** the "OpenWav Overview" dashboard is provisioned automatically. The admin dashboard shows live service health, P95/P99 and active alerts.
