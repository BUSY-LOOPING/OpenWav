#!/bin/sh
set -eu
file=/etc/nginx/ops.htpasswd
: > "$file"
if [ -n "${OPS_PASSWORD:-}" ]; then
  printf '%s:%s\n' "${OPS_USER:-admin}" "$(openssl passwd -apr1 "$OPS_PASSWORD")" > "$file"
fi
# Edited by Claude Code
