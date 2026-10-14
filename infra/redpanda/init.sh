#!/bin/sh
set -eu
brokers="${KAFKA_BROKERS:-redpanda:9092}"
admin="${REDPANDA_ADMIN:-redpanda:9644}"
retention="${EVENTS_RETENTION_MS:-2592000000}"
rpk() { command rpk -X "brokers=${brokers}" -X "admin.hosts=${admin}" "$@"; }
tries=0
until rpk cluster health --exit-when-healthy >/dev/null 2>&1; do
  tries=$((tries + 1))
  [ "$tries" -ge 60 ] && { echo "redpanda not healthy after 120s" >&2; exit 1; }
  sleep 2
done
if rpk topic describe openwav.events >/dev/null 2>&1; then
  rpk topic alter-config openwav.events --set "retention.ms=${retention}"
else
  rpk topic create openwav.events -p 6 -r 1 -c "retention.ms=${retention}"
fi
echo "topic openwav.events ready"
