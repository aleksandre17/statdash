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

# ── check_zero — strict retirement lock (scans EVERYTHING, incl. comments+tests) ──
#
#  Unlike check_ts (which exempts comments + .test. files for the i18n/dim laws),
#  a RETIREMENT lock must catch a deleted surface returning ANYWHERE — code, a
#  comment, a test, or a seed JSON. So this scans *.ts/*.tsx/*.json with no comment
#  or test exclusions: a token that was grep-zeroed cannot creep back under any guise.
#  Args: label, ERE pattern, then one-or-more paths to scan.
check_zero() {
  local label="$1"
  local pattern="$2"
  shift 2
  local results
  results=$(grep -rnE --include="*.ts" --include="*.tsx" --include="*.json" "$pattern" "$@" 2>/dev/null \
    | grep -v "^Binary" \
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

  # Retirement lock (Law 6 / Lehman) — the orphaned filter-effect subsystem
  # (`Effect` type · `applyEffects` · `schema.effects` · the RenderContext/FiltersCtx
  # threading) was deleted WHOLESALE: P6 removed its only caller (System A), leaving a
  # caller-less mechanism where a declared `schema.effects` was a SILENT no-op (a
  # footgun, not a feature). Lock it out so it cannot silently return (same spirit as
  # the perspective grep-zero acceptance). The three tokens hit the function, the
  # `Effect[]` type (incl. a reintroduced `effects?: Effect[]` field), and `.effects`
  # property access — never the unrelated word "side-effect" in a comment.
  check_ts "Retired: no applyEffects / Effect[] / .effects filter-effect subsystem in engine" \
    'applyEffects\|Effect\[\]\|\.effects\b' "$ENGINE/src"

  check_ts "Retired: no applyEffects / Effect[] / .effects filter-effect subsystem in react" \
    'applyEffects\|Effect\[\]\|\.effects\b' "$REACT/src"

  # ── FF-NO-MODE-LITERAL — the fused-mode literal can never regress ───────────────
  #
  #  The orthogonal-axis law (DESIGN-time-mode-decision §0/§6, R3): `year`/`range` are
  #  two VALUES of one axis, never two hardcoded branches. No engine/react code may
  #  compare a perspective against `=== 'range'`/`'quarter'`/`'month'`, nor sniff a
  #  two-arm `{ year, range }` fused carrier (`'year' in x` / `'range' in x`). This is
  #  the bash twin of the vitest SSOT (packages/core/src/config/no-mode-literal.fitness.test.ts).
  #  The MED finding it locks out lived at template.ts:74-75. (`format === 'year'` in
  #  i18n/format.ts is a DATE-FORMAT kind, not a perspective id — NOT matched here.)
  check_ts "FF-NO-MODE-LITERAL: no fused {year,range} mode-literal branch in engine" \
    "=== '\(range\|quarter\|month\)'\|'\(year\|range\)' in " "$ENGINE/src"

  check_ts "FF-NO-MODE-LITERAL: no fused {year,range} mode-literal branch in react" \
    "=== '\(range\|quarter\|month\)'\|'\(year\|range\)' in " "$REACT/src"

  # ── Retired System-A island: the site-scoped `modes` perspective registry ──────
  #
  #  MED-2 deleted the write-with-no-read `SiteManifestContract.modes` channel: the
  #  ManifestMode type, the bootstrap serve path (DEFAULT_MODES / site_config 'modes'
  #  key), the App.tsx consumer, and the runner `modes` field. The perspective-bar
  #  derives from each page's authored `page.perspectives` axis (the SSOT); the
  #  Constructor palette fills perspectiveRegistry itself (apps/panel setupCanvasRegistry).
  #  This is the grep-zero acceptance the P6 System-A claim excluded — it extends the
  #  lock into the contracts + apps/api + apps/geostat tiers so the `modes` vocabulary
  #  cannot silently return. (The legitimate `?mode=` URL param + `mode:` hidden filter
  #  param + `page.perspectives` axis are a DIFFERENT, live surface — not matched here.)
  #  NOTE: this code lock co-ships with the V35 Flyway DELETE of the orphaned prod row.
  CONTRACTS="$ROOT/platform/packages/contracts/src"
  API_SRC="$ROOT/platform/apps/api/src"
  GEOSTAT_SRC="$ROOT/platform/apps/geostat/src"
  PROVISIONING="$ROOT/platform/apps/api/provisioning"

  check_zero "Retired System-A: no ManifestMode / DEFAULT_MODES (contracts+api+geostat)" \
    'ManifestMode|DEFAULT_MODES' "$CONTRACTS" "$API_SRC" "$GEOSTAT_SRC"

  check_zero "Retired System-A: no manifest .modes field access (contracts+api+geostat)" \
    '\.modes\b' "$CONTRACTS" "$API_SRC" "$GEOSTAT_SRC"

  check_zero "Retired System-A: no site_config 'modes' seed key (provisioning artifact)" \
    '"key":[[:space:]]*"modes"' "$PROVISIONING"

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
