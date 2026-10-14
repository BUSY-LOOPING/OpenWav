#!/usr/bin/env bash
set -euo pipefail

base="${PUBLIC_BASE_URL:-https://localhost:8443}"
secret="${STREAM_SIGNING_SECRET:?STREAM_SIGNING_SECRET is required}"
key="${SMOKE_OBJECT_KEY:-}"
fail=0

check() {
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (expected $3, got $2)"; fail=1; fi
}

check "http2 negotiated" "$(curl -sk --http2 -o /dev/null -w '%{http_version}' "$base/")" "2"
check "api health" "$(curl -sk -o /dev/null -w '%{http_code}' "$base/api/v1/health")" "200"

sign() {
  local uri="$1" expires="$2"
  printf '%s%s %s' "$expires" "$uri" "$secret" | openssl md5 -binary | openssl base64 | tr '+/' '-_' | tr -d '='
}

expires=$(( $(date +%s) + 300 ))
check "unsigned stream rejected" "$(curl -sk -o /dev/null -w '%{http_code}' "$base/stream/none.mp3")" "403"
check "expired stream rejected" "$(curl -sk -o /dev/null -w '%{http_code}' "$base/stream/none.mp3?md5=$(sign /stream/none.mp3 1)&expires=1")" "410"

if [ -n "$key" ]; then
  uri="/stream/$key"
  url="$base$uri?md5=$(sign "$uri" "$expires")&expires=$expires"
  headers=$(curl -sk -D - -o /dev/null -H 'Range: bytes=0-1023' "$url")
  check "range returns 206" "$(printf '%s' "$headers" | awk 'NR==1{print $2}')" "206"
  printf '%s' "$headers" | grep -qi '^content-range: bytes 0-1023/' && echo "ok   content-range" || { echo "FAIL content-range"; fail=1; }
  printf '%s' "$headers" | grep -qi '^accept-ranges: bytes' && echo "ok   accept-ranges" || { echo "FAIL accept-ranges"; fail=1; }
else
  echo "skip range test (set SMOKE_OBJECT_KEY to an object in the audio bucket)"
fi

exit "$fail"
