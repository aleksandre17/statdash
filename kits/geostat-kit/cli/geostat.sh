#!/bin/bash
set -euo pipefail
PKG="$(cd "$(dirname "$0")/.." && pwd)"
export GEOSTAT_KIT_ROOT="$PKG"
ROOT="${GEOSTAT_PROJECT_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  dir="$(pwd)"
  while [[ -n "$dir" && "$dir" != "/" ]]; do
    [[ -f "$dir/geostat.ops.json" ]] && ROOT="$dir" && break
    dir="$(dirname "$dir")"
  done
fi
[[ -n "$ROOT" ]] || { echo "ERROR: geostat.ops.json not found"; exit 1; }
export GEOSTAT_PROJECT_ROOT="$ROOT"
CMD="${1:-help}"
shift || true

case "$CMD" in
  init) exec bash "$PKG/toolkit/init/init.sh" "$@" ;;
  validate) export PYTHONPATH="$PKG${PYTHONPATH:+:$PYTHONPATH}"; exec python3 "$PKG/lib/validate_manifest.py" ;;
  migrate) export PYTHONPATH="$PKG${PYTHONPATH:+:$PYTHONPATH}"; exec python3 "$PKG/lib/migrate_manifest.py" "$@" ;;
  vscode-gen) export PYTHONPATH="$PKG${PYTHONPATH:+:$PYTHONPATH}"; exec python3 "$PKG/lib/vscode_gen.py" "$@" ;;
  compose-gen) exec python3 "$PKG/compose/build.py" ;;
  nginx-gen) exec python3 "$PKG/adapters/render_nginx.py" ;;
  stack-deploy) exec bash "$PKG/toolkit/deploy/stack-remote.sh" "$@" ;;
  infra)
    if [[ $# -gt 0 ]]; then
      if command -v pwsh >/dev/null 2>&1; then
        exec pwsh -NoProfile -ExecutionPolicy Bypass -File "$PKG/toolkit/infra/Invoke-Infra.ps1" "$@"
      fi
      if command -v powershell.exe >/dev/null 2>&1; then
        exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PKG/toolkit/infra/Invoke-Infra.ps1" "$@"
      fi
      echo "ERROR: pwsh or powershell required for: geostat infra $*"
      exit 1
    fi
    exec bash "$PKG/toolkit/infra/ensure-prereqs.sh"
    ;;
  stack) exec bash "$PKG/toolkit/stack/compose.sh" "$@" ;;
  *)
    exec powershell -ExecutionPolicy Bypass -File "$ROOT/tools/geostat.ps1" "$CMD" "$@" 2>/dev/null \
      || exec powershell -ExecutionPolicy Bypass -File "$PKG/cli/geostat.ps1" "$CMD" "$@"
    ;;
esac
