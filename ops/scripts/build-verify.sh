#!/usr/bin/env bash
# Verifies all apps compile cleanly (tsc --noEmit) without a full build.
# Usage: ./build-verify.sh [module]
# Example: ./build-verify.sh geostat   → verify only geostat
#          ./build-verify.sh           → verify all modules
#
# Exits 0 = all clean, 1 = any errors

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MODULE="${1:-}"
FAILURES=0

echo "═══════════════════════════════════════"
echo " statdash-platform Build Verify"
echo "═══════════════════════════════════════"

verify_module() {
  local name="$1"
  local path="$2"

  echo ""
  echo "── $name ($path) ──"

  if [[ ! -d "$ROOT/$path" ]]; then
    echo "   ⚠️  directory not found, skipping"
    return
  fi

  output=$(cd "$ROOT" && npx tsc --noEmit -p "$path/tsconfig.json" 2>&1)
  if [[ $? -eq 0 ]]; then
    echo "   ✅ tsc clean"
  else
    echo "   ❌ tsc errors:"
    echo "$output" | sed 's/^/      /'
    FAILURES=$((FAILURES + 1))
  fi
}

verify_package() {
  local name="$1"
  local path="$2"

  echo ""
  echo "── $name ($path) ──"

  if [[ ! -d "$ROOT/$path" ]]; then
    echo "   ⚠️  directory not found, skipping"
    return
  fi

  output=$(cd "$ROOT/$path" && npx tsc --noEmit 2>&1)
  if [[ $? -eq 0 ]]; then
    echo "   ✅ tsc clean"
  else
    echo "   ❌ tsc errors:"
    echo "$output" | sed 's/^/      /'
    FAILURES=$((FAILURES + 1))
  fi
}

case "${MODULE:-all}" in
  geostat)
    verify_module "geostat" "apps/geostat"
    ;;
  panel)
    verify_module "panel" "apps/panel"
    ;;
  engine)
    verify_package "engine" "engine/core"
    ;;
  react)
    verify_package "react-pkg" "engine/react"
    ;;
  all)
    verify_package "engine"    "engine/core"
    verify_package "react-pkg" "engine/react"
    verify_module  "geostat"   "apps/geostat"
    verify_module  "panel"     "apps/panel"
    ;;
  *)
    echo "Unknown module: $MODULE"
    echo "Usage: $0 [geostat|panel|engine|react|all]"
    exit 1
    ;;
esac

echo ""
echo "═══════════════════════════════════════"
if [[ $FAILURES -eq 0 ]]; then
  echo " ✅ All modules clean"
else
  echo " ❌ $FAILURES module(s) have errors"
fi
echo "═══════════════════════════════════════"

exit $((FAILURES > 0 ? 1 : 0))
