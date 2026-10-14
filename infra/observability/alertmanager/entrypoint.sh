#!/bin/sh
set -eu
out=/tmp/alertmanager.yml
receivers=""
routes=""

if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  receivers="$receivers
  - name: webhook
    webhook_configs:
      - url: '${ALERT_WEBHOOK_URL}'
        send_resolved: true"
  routes="$routes
    - receiver: webhook
      continue: true"
fi

if [ -n "${ALERT_SLACK_WEBHOOK_URL:-}" ]; then
  receivers="$receivers
  - name: slack
    slack_configs:
      - api_url: '${ALERT_SLACK_WEBHOOK_URL}'
        channel: '${ALERT_SLACK_CHANNEL:-#alerts}'
        send_resolved: true
        title: '{{ .CommonLabels.alertname }} [{{ .CommonLabels.severity }}]'
        text: '{{ range .Alerts }}{{ .Annotations.summary }} {{ end }}'"
  routes="$routes
    - receiver: slack
      continue: true"
fi

if [ -n "${ALERT_EMAIL_TO:-}" ]; then
  receivers="$receivers
  - name: email
    email_configs:
      - to: '${ALERT_EMAIL_TO}'
        from: '${SMTP_FROM:-alerts@openwav.local}'
        smarthost: '${SMTP_HOST:-localhost}:${SMTP_PORT:-587}'
        auth_username: '${SMTP_USER:-}'
        auth_password: '${SMTP_PASSWORD:-}'
        require_tls: ${SMTP_REQUIRE_TLS:-true}
        send_resolved: true"
  routes="$routes
    - receiver: email
      continue: true"
fi

cat > "$out" <<YAML
route:
  receiver: log
  group_by: [alertname, service]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - receiver: log
      continue: true${routes}
receivers:
  - name: log${receivers}
YAML

exec /bin/alertmanager --config.file="$out" --storage.path=/alertmanager "$@"
