#!/bin/bash
# Wait for HTTP health endpoints (used by CI)
set -euo pipefail

url="${1:-http://localhost:8090/health}"
expect="${2:-UP}"
max="${3:-60}"
i=0

echo "[ci] Waiting for $url (expect: ${expect:-HTTP}, max ${max}s)"
if [[ -z "$expect" || "$expect" == "-" || "$expect" == "HTTP" ]]; then
  until curl -fsS "$url" >/dev/null; do
    i=$((i + 1))
    if [[ $i -ge $max ]]; then
      echo "[ci] TIMEOUT: $url"
      curl -v "$url" 2>&1 || true
      exit 1
    fi
    sleep 2
  done
else
  until curl -fsS "$url" | grep -q "$expect"; do
    i=$((i + 1))
    if [[ $i -ge $max ]]; then
      echo "[ci] TIMEOUT: $url"
      curl -v "$url" 2>&1 || true
      exit 1
    fi
    sleep 2
  done
fi
echo "[ci] OK: $url"
