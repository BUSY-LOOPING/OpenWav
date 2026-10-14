#!/bin/sh
set -eu
dir=/etc/nginx/certs
mkdir -p "$dir"
if [ ! -s "$dir/tls.crt" ] || [ ! -s "$dir/tls.key" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$dir/tls.key" -out "$dir/tls.crt" \
    -subj "/CN=${TLS_COMMON_NAME:-localhost}" \
    -addext "subjectAltName=DNS:${TLS_COMMON_NAME:-localhost},DNS:localhost,IP:127.0.0.1"
fi
