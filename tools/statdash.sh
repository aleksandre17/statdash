#!/bin/bash
# statdash-platform CLI shim — forwards to ops/cli (canonical)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/ops/cli/statdash.sh" "$@"
