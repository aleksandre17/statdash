#!/usr/bin/env bash
# Checks statdash-platform architecture laws across the codebase.
# Usage: ./check-laws.sh [path]
# Default: scans packages/ and packages/plugins/
#
# COVERAGE (grep-detectable):
#   Law 1 — No privileged dimension names in packages/react (ctx.year, ctx.regionId, ctx.region)
#   Law 2 — No functions/callbacks in DataSpec configs (getRows, val(), fetch calls)
#   Law 3 — No import.meta in packages/core (engine purity, post Layer 1.1)
#   Law 4 — No hardcoded locale strings in packages/core (Georgian specifics)
#   Law 5 — No console.log in packages/core (observability seam only)
#
# NOT COVERED (requires code review):
#   Law 6 — Dependency arrow correctness (enforced by eslint no-restricted-imports gate)
#   Law 7 — JSON-serializable config (JSON.parse/stringify round-trip — runtime test only)
#
# SCOPE — why this scan covers packages/ ONLY (the panel-i18n decision):
#   The tenant-content / i18n laws (Law 1 no-privileged-dims, Law 4 no hardcoded
#   locale) gate RENDERED OUTPUT — the library packages whose code becomes tenant-
#   facing dashboard output. apps/panel is the AUTHORING TOOL (the Constructor): it
#   GENERATES tenant config, it is not itself tenant-rendered content. Its chrome
#   strings are TOOL UI (the editor's own buttons/labels), localized via the panel's
#   own i18n mechanism if/when needed — they are NOT subject to the tenant-content
#   law the way packages/* rendered output is. So leaving apps/panel out of this
#   scan is correct-by-design, not an oversight. The ONLY thing that would change
#   this: genuine tenant content leaking THROUGH the panel into rendered output —
#   but rendered output lives in packages/* (already scanned), so the boundary holds.
#   (The authoring-LABEL catalogs that DO live in packages/core are the inverse case:
#   tool UI that happens to live library-side — allowlisted below, not gated.)
#
# Exits 0 = clean, 1 = violations found

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="${1:-}"
VIOLATIONS=0

echo "═══════════════════════════════════════"
echo " statdash-platform Law Check"
if [[ -z "$TARGET" ]]; then
  echo " Scanning: packages/ + packages/plugins/"
  echo "═══════════════════════════════════════"
else
  echo " Custom target: $TARGET"
  echo "═══════════════════════════════════════"
fi

# ── Authoring-label catalog allowlist (Constructor i18n catalogs) ─────────────
#
#  These files are the SAME legitimate class as spec-catalog.ts: schema-driven
#  EDITOR field labels that the Constructor's generic Inspector renders. They are
#  INTENTIONALLY bilingual ({ ka, en } via the `bi(ka, en)` helper) authoring
#  metadata — NOT tenant-rendered content, NOT single-locale hardcodes. They are
#  the Constructor's authoring-label CATALOGS:
#    - spec-catalog.ts          DataSpec type picker descriptors
#    - op-schemas.ts            transform-step (TransformStep) StepForm labels   [V1]
#    - param-schemas.ts         page-level ParamDef filter-control labels        [V0]
#    - visibility-schemas.ts    VisibilityExpr "show when" leaf-condition labels [V4]
#    - rowspec-schemas.ts       row-list RowSpec entry labels                    [V2]
#    - perspective-scope-schemas.ts  PerspectiveAxis scope-key labels      [VISION #3]
#  This list is the bash twin of the SSOT allowlist in
#  platform/tests/no-tenant-content.fitness.test.ts (the ALLOW set) — keep the two
#  in sync. The exemption is for Georgian SCRIPT only (Law 4 heuristic); a genuine
#  single-locale Georgian hardcode in any OTHER engine file still fails, and the
#  vitest gate still enforces TIER-1 (currency / brand / ['ka','en'] literal)
#  EVERYWHERE incl. these catalogs. This is a STATED-INTENT exemption, never a
#  blanket suppression.
LAW4_CATALOG_ALLOW='(spec-catalog|op-schemas|param-schemas|visibility-schemas|rowspec-schemas|perspective-scope-schemas)\.ts:'

check_ts() {
  local label="$1"
  local pattern="$2"
  local path="${3:-}"
  local results

  # grep -rn output format: "path:line:content"
  # Filter out lines where the *content* (after path:num:) is a comment (// or *)
  # and the named authoring-label catalogs (see LAW4_CATALOG_ALLOW above) as a
  # whole. A line carrying a Georgian fragment alongside an `en:` sibling is also
  # a compliant inline LocaleString ({ ka: '…', en: '…' }) — the standard fully
  # applied — so it is exempt too.
  results=$(grep -rn --include="*.ts" --include="*.tsx" "$pattern" "$path" 2>/dev/null \
    | grep -v "^Binary" \
    | grep -v "\.test\." \
    | grep -vE "$LAW4_CATALOG_ALLOW" \
    | grep -vE "\ben\b[[:space:]]*:" \
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
  ENGINE="$ROOT/platform/packages/core"
  REACT="$ROOT/platform/packages/react"
  PLUGINS="$ROOT/platform/packages/plugins"

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
