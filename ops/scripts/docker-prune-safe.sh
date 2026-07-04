#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# docker-prune-safe.sh — scheduled disk hygiene for the statdash prod host.
#
# Reclaims Docker build cache + DANGLING (untagged) images only. This is the SAFE
# subset — it will NEVER touch:
#   • named/anonymous VOLUMES  (the postgres DB volume lives there) → no --volumes
#   • TAGGED images            (`:latest`, `:rollback` deploy-rollback tags)  → no -a
#
# Rationale (ADR-019): `/dev/sda2` (147G) drifts toward 100% because `--no-cache`
# 3-image builds create bursts of dangling layers + build cache with no reaper.
# Build cache with 0 active refs is always safe to drop; dangling images are the
# untagged leftovers of a rebuild. `-a` would remove the `:rollback` images (they
# are not attached to a running container) — FORBIDDEN. `--volumes` would delete
# the DB volume — FORBIDDEN.
#
# Install (user-level cron for the `administrator` user — no root needed; the user
# is in the docker group):  see ops/scripts/install-prune-cron.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOG="${STATDASH_PRUNE_LOG:-/home/administrator/statdash-ops/docker-prune.log}"
mkdir -p "$(dirname "$LOG")"

{
  echo "===== docker-prune-safe $(date -u +%Y-%m-%dT%H:%M:%SZ) ====="
  echo "--- df before ---"
  df -h / | tail -1
  echo "--- docker builder prune -f (build cache, 0-active is safe) ---"
  docker builder prune -f
  echo "--- docker image prune -f (DANGLING/untagged only; NEVER -a, NEVER --volumes) ---"
  docker image prune -f
  echo "--- df after ---"
  df -h / | tail -1
  echo "===== done ====="
} >>"$LOG" 2>&1
