#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# dev-watch-panel.sh — server-side LIVE-WATCH sync for the isolated dev line panel.
#
# Rsyncs local `platform/apps/panel/src` → the server-side mount dir consumed by the
# source-mounted vite dev container (statdash-dev-panel-full on statdash-dev, :3013).
# A saved edit reflects LIVE via vite HMR with NO rebuild. This is the robust,
# under-our-control equivalent of the kit `dev watch` driver (which short-circuits in
# the MSYS2/Git-Bash shell — its compose-up step never fires).
#
# ── USAGE ────────────────────────────────────────────────────────────────────
#   Continuous watch (poll + sync on change, run on your workstation):
#     bash ops/scripts/dev-watch-panel.sh
#   One-shot sync (also the documented sync-on-save one-liner — see below):
#     bash ops/scripts/dev-watch-panel.sh --once
#
#   Documented one-liner equivalent (no script) — run from repo root:
#     PATH="/c/msys64/usr/bin:$PATH" HOME="/c/msys64/home/Test-User" \
#       rsync -az --delete --exclude node_modules --exclude dist --exclude .git \
#       -e /c/msys64/usr/bin/ssh \
#       platform/apps/panel/src/ geostat-deploy:/home/administrator/statdash-dev-src/platform/apps/panel/src/
#
# ── THE PROVEN RECIPE (why these knobs) ──────────────────────────────────────
#   • MSYS2 rsync + MSYS2 ssh on PATH (Git's ssh + MSYS2 rsync = `dup() failed` fd bug).
#   • HOME=/c/msys64/home/Test-User — MSYS2 ssh reads its passwd-home ~/.ssh/config
#     (the geostat-deploy Host block: HostName 192.168.1.199, User administrator,
#     IdentityFile, StrictHostKeyChecking no).
#   • --exclude node_modules --exclude dist --exclude .git — the excludes are what make
#     rsync return exit 0 (unexcluded node_modules / vanishing files gave the kit driver
#     a non-zero code); also never ship host-built (Windows) node_modules to Linux.
#   • Local paths are MSYS2-space /c/... (NOT Git-Bash /tmp, NOT Windows C:\).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── The working toolchain env (MSYS2 rsync + MSYS2 ssh) ──────────────────────
export PATH="/c/msys64/usr/bin:$PATH"
export HOME="${MSYS2_HOME:-/c/msys64/home/Test-User}"

# ── Config (override via env) ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVER="${SERVER:-geostat-deploy}"                                # ssh host alias
LOCAL_SRC="${LOCAL_SRC:-$ROOT/platform/apps/panel/src}"           # what to watch
REMOTE_SRC="${DEV_PANEL_SRC:-/home/administrator/statdash-dev-src/platform/apps/panel/src}"
SSH_BIN="${SSH_BIN:-/c/msys64/usr/bin/ssh}"
INTERVAL="${INTERVAL:-1}"                                         # poll seconds

RSYNC_EXCLUDES=(--exclude node_modules --exclude dist --exclude .git)

log() { printf '[%s] %s\n' "$(date +'%H:%M:%S')" "$*"; }

sync_once() {
  # --itemize-changes so we can report only when something actually moved.
  local out
  out="$(rsync -az --delete --itemize-changes "${RSYNC_EXCLUDES[@]}" \
    -e "$SSH_BIN" "$LOCAL_SRC/" "$SERVER:$REMOTE_SRC/")"
  if [[ -n "$out" ]]; then
    log "synced:"; printf '%s\n' "$out" | sed 's/^/    /'
  fi
}

[[ -d "$LOCAL_SRC" ]] || { echo "LOCAL_SRC not found: $LOCAL_SRC" >&2; exit 1; }

if [[ "${1:-}" == "--once" ]]; then
  log "one-shot sync $LOCAL_SRC → $SERVER:$REMOTE_SRC"
  sync_once
  log "done."
  exit 0
fi

log "watching $LOCAL_SRC → $SERVER:$REMOTE_SRC (poll ${INTERVAL}s; Ctrl-C to stop)"
log "initial sync…"; sync_once
while true; do
  sleep "$INTERVAL"
  sync_once
done
