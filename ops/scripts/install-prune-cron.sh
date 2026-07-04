#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# install-prune-cron.sh — install the safe Docker prune (docker-prune-safe.sh) as
# a USER-level cron entry for the current user (no root/sudo required — the user is
# in the docker group). Idempotent: re-running replaces the managed line only.
#
# Schedule: 04:17 daily (off-peak, avoids the top-of-hour cron stampede).
# The script itself is copied to a PERSISTENT home path (not /tmp, which is the
# ephemeral deploy-clone location).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEST_DIR="/home/administrator/statdash-ops"
DEST="$DEST_DIR/docker-prune-safe.sh"
SRC="$(cd "$(dirname "$0")" && pwd)/docker-prune-safe.sh"
MARK="# statdash-docker-prune-safe (managed by install-prune-cron.sh)"

mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST"
chmod +x "$DEST"

# Rebuild crontab: keep every line except a prior managed entry, then append ours.
CRON_LINE="17 4 * * * $DEST $MARK"
( crontab -l 2>/dev/null | grep -vF "$MARK" || true; echo "$CRON_LINE" ) | crontab -

echo "Installed:"
echo "  script : $DEST"
echo "  cron   : $CRON_LINE"
echo "Current crontab:"
crontab -l | grep -F "$MARK" || true
