#!/bin/bash
# statdash-platform CLI entry — forwards to geostat-kit
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export GEOSTAT_PROJECT_ROOT="$ROOT"
exec bash "$ROOT/kits/geostat-kit/cli/geostat.sh" "$@"
