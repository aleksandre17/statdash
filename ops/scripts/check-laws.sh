#!/usr/bin/env bash
# Checks statdash-platform architecture laws across the codebase.
# Usage: ./check-laws.sh [path]
# Default: scans engine/ and engine/plugins/
#
# COVERAGE (grep-detectable):
#   Law 1 — No privileged dimension names in engine/react (ctx.year, ctx.regionId, ctx.region)
#   Law 2 — No functions/callbacks in DataSpec configs (getRows, val(), fetch calls)
#   Law 3 — No import.meta in engine/core (engine purity, post Layer 1.1)
#   Law 4 — No hardcoded locale strings in engine/core (Georgian specifics)
#   Law 5 — No console.log in engine/core (observability seam only)
#
# NOT COVERED (requires code review):
#   Law 6 — Dependency arrow correctness (enforced by eslint no-restricted-imports gate)
#   Law 7 — JSON-serializable config (JSON.parse/stringify round-trip — runtime test only)
#
# Exits 0 = clean, 1 = violations found

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="${1:-}"
VIOLATIONS=0

echo "═══════════════════════════════════════"
echo " statdash-platform Law Check"
if [[ -z "$TARGET" ]]; then
  echo " Scanning: engine/ + engine/plugins/"
  echo "═══════════════════════════════════════"
else
  echo " Custom target: $TARGET"
  echo "═══════════════════════════════════════"
fi

check_ts() {
  local label="$1"
  local pattern="$2"
  local path="${3:-}"
  local results

  # grep -rn output format: "path:line:content"
  # Filter out lines where the *content* (after path:num:) is a comment (// or *)
  results=$(grep -rn --include="*.ts" --include="*.tsx" "$pattern" "$path" 2>/dev/null \
    | grep -v "^Binary" \
    | grep -v "\.test\." \
    | grep -vE ":[0-9]+:[[:space:]]*//" \
    | grep -vE ":[0-9]+:[[:space:]]*\*" \
    | head -10)

  if [[ -n "$results" ]]; then
    echo "❌ $label"
    echo "$results" | sed 's/^/   /'
    VIOLATIONS=$((VIOLATIONS + 1))
  else
    echo "✅ $label"
  fi
}

if [[ -z "$TARGET" ]]; then
  ENGINE="$ROOT/platform/engine/core"
  REACT="$ROOT/platform/engine/react"
  PLUGINS="$ROOT/platform/engine/plugins"

  # Law 1 — No privileged dimension names in engine
  check_ts "Law 1: No ctx.year / ctx.regionId / ctx.region in engine" \
    'ctx\.\(year\|regionId\|region\b\|time\b\)' "$ENGINE"

  check_ts "Law 1: No ctx.year / ctx.regionId in react package" \
    'ctx\.\(year\|regionId\|region\b\)' "$REACT"

  # Law 2 — No functions in DataSpec configs
  check_ts "Law 2: No getRows callback in DataSpec/config files" \
    'getRows\s*:' "$ENGINE/src"

  # Law 2: fetch() is allowed only in ApiDataStore (network adapter); check only spec/config files
  check_ts "Law 2: No fetch() in DataSpec or config types (only in store adapters)" \
    '\bfetch(' "$ENGINE/src/data/spec.ts" "$ENGINE/src/config"

  # Law 3 — Engine purity: no import.meta
  check_ts "Law 3: No import.meta in packages/engine (use SpecResolveObserver)" \
    'import\.meta' "$ENGINE/src"

  # Law 4 — No Georgian locale strings in engine
  check_ts "Law 4: No Georgian locale literals in engine (\.ka / \.en / \.ru)" \
    '"\.ka"\|"\.en"\|"\.ru"\|'\''\.ka'\''\|'\''\.en'\''\|'\''\.ru'\''' "$ENGINE/src"

  check_ts "Law 4: No hardcoded Georgian text in engine" \
    'გა\|ვე\|ება\|ის\|ობ' "$ENGINE/src"

  # Law 5 — No console.log in engine (only console.warn via observer seam is allowed)
  check_ts "Law 5: No console.log in packages/engine (use observer seam)" \
    'console\.log' "$ENGINE/src"

else
  check_ts "Law 1: No privileged dimensions" \
    'ctx\.\(year\|regionId\|region\b\)' "$TARGET"

  check_ts "Law 2: No functions in DataSpec" \
    'getRows\s*:\|val()\|fetch(' "$TARGET"

  check_ts "Law 3: No import.meta" \
    'import\.meta' "$TARGET"

  check_ts "Law 4: No locale literals" \
    '"\.ka"\|"\.en"\|"\.ru"' "$TARGET"

  check_ts "Law 5: No console.log" \
    'console\.log' "$TARGET"
fi

echo "═══════════════════════════════════════"
if [[ $VIOLATIONS -eq 0 ]]; then
  echo " ✅ All laws clean"
else
  echo " ❌ $VIOLATIONS violation(s) found"
fi
echo "═══════════════════════════════════════"

exit $((VIOLATIONS > 0 ? 1 : 0))
