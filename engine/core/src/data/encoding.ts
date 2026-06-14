// ── Standard 3: Grammar of Graphics — Vega-Lite Encoding ─────────────
//
//  Maps observation/row fields to visual channels.
//  One EncodingSpec drives both Table (column mapping) and Chart (axis mapping).
//  100% JSON-serializable — constructor/admin panel can generate these.
//
//  Visual channel analogy (Vega-Lite → ours):
//    x            → label    (row label / x-axis)
//    y            → value    (measure / y-axis)
//    color/xOffset → series  (grouping dimension — multi-series / pivot columns)
//    color (field) → color   (explicit per-row color from observation field)
//    tooltip      → tooltip  (extra fields shown on hover)
//
//  Golden rule: data is never pivoted. EncodingSpec tells the renderer HOW
//  to pivot. DataRow[] is always long format (one row per observation).
//

import type { DimVal } from '../sdmx'

// ── EngineRow — neutral output type of interpretSpec ─────────────────
//
//  The engine data layer is renderer-agnostic. interpretSpec returns
//  EngineRow[] — plain field→value records with no renderer concepts.
//  Renderers apply applyEncoding at their boundary to get typed DataRow[].
//
//  Pattern: Grafana DataFrames (raw) → panel applies field overrides.
//           Vega-Lite data (raw) → mark+encoding drives rendering.
//           Cube.dev resultSet → chartPivot/tablePivot in the renderer.
//
/** Neutral engine output row — DimVal-typed, renderer-agnostic. */
export type EngineRow = Record<string, DimVal>

/**
 * Encoding spec — maps observation fields to DataRow visual channels.
 * Analogous to Vega-Lite's encoding object. 100% JSON-serializable.
 */
export interface EncodingSpec {
  // ── Primary channels ─────────────────────────────────────────────────

  /** Which obs field becomes DataRow.label (x-axis label / table row label). */
  label:          string

  /** Which obs field becomes DataRow.value. Default: 'value'. */
  value?:         string

  /** Which obs field drives DataRow.color (explicit field, not auto-assigned). */
  color?:         string

  /**
   * Which obs field becomes DataRow.series — the grouping dimension.
   * Vega-Lite equivalent: 'color' / 'xOffset' channel.
   * When present → Chart renders multi-series, DataTable renders pivot columns.
   */
  series?:        string

  // ── Computed channels ────────────────────────────────────────────────

  /**
   * Compute DataRow.pct:
   *   { of: 'CODE' }     → |value| / store.val('CODE', ctx) × 100   (OLAP point lookup)
   *   { sumOf: 'FIELD' } → |value| / Σ obs[FIELD] × 100             (% of query total — Tableau pattern)
   *                        denominator = sum of all rows returned by this query
   *   { field: 'pct' }   → read directly from observation field (pre-computed)
   */
  pct?:           { of: string } | { sumOf: string } | { field: string }

  /** Measure codes whose values should be negated (outflow / debit rows). */
  negate?:        string[]

  // ── Multi-series / pivot controls ────────────────────────────────────

  /**
   * Per-series formatter name — references FORMATTERS registry in transform.ts.
   * JSON-serializable: { gva: 'mln_gel', growth: 'sign_pct', share: 'pct' }
   * DataTable applies seriesFormat[seriesName] per column in pivot mode.
   */
  seriesFormat?:  Record<string, string>

  /**
   * Explicit column/series order.
   * Left-to-right in DataTable pivot mode; legend order in Chart.
   * Series not listed here appear after listed ones in source order.
   */
  seriesOrder?:   string[]

  // ── Tooltip channel ──────────────────────────────────────────────────

  /**
   * Extra observation fields shown in chart tooltip and table row hover.
   * Vega-Lite tooltip channel analogue. JSON-serializable.
   * e.g. ['unit', 'status', 'source']
   * Renderers read these field names and look them up on the raw observation.
   */
  tooltip?:       string[]

  // ── Structural / hierarchy channels ──────────────────────────────────
  // Map generic pipe-layer metadata fields (e.g. from the `group` op) to
  // DataRow structural slots. The pipe produces plain RawRow fields; the
  // encoding decides their meaning for the downstream renderer.

  /** Obs field carrying an explicit id — overrides auto-generated id. */
  id?:            string
  /** Obs field holding a truthy value → DataRow.isSeparator = true. */
  isSeparator?:   string
  /** Obs field holding a truthy value → DataRow.isTotal = true. */
  isTotal?:       string
  /** Obs field holding integer depth → DataRow.level (indent / nesting). */
  level?:         string
  /** Obs field holding a parent row id → DataRow.parentId (tree linking). */
  parentId?:      string
}

/**
 * Neutral data row — output of interpretSpec, input to Table and Chart renderers.
 *
 * Both renderers receive the same DataRow[]; visual logic lives in the renderer,
 * not in the data. This is the Grammar of Graphics separation of concerns:
 *   data layer (DataRow[]) ≠ rendering layer (Chart/Table component).
 */
export interface DataRow {
  id:           string
  label:        string
  /** Grouping dimension — Chart renders multi-series; DataTable renders pivot columns. */
  series?:      string
  value:        number
  pct?:         number
  color?:       string
  isTotal?:     boolean
  isSeparator?: boolean
  /** Hierarchy depth — 0=root, 1=child, 2=grandchild. SDMX HierarchicalCodelist / OLAP drill-down. */
  level?:       number
  /** Parent DataRow.id — enables tree rendering and roll-up aggregation. */
  parentId?:    string
  /**
   * SDMX OBS_STATUS — data quality / revision flag (IMF / Eurostat standard).
   * A = normal (default, not displayed)
   * p = preliminary   → badge 'წინ.'
   * e = estimate       → badge 'შეფ.'
   * r = revised        → badge 'განახ.'
   * c = confidential   → badge 'კონფ.'
   */
  status?:      'A' | 'p' | 'e' | 'r' | 'c'
}


// ── applyEncoding — Grammar of Graphics field→channel mapping ─────────
//
//  Maps a raw row array (pipe output) to DataRow[] using an EncodingSpec.
//  Pure function — no store, no context, no side effects.
//  The single `lookup` callback handles the pct.of denominator variant;
//  callers curry it as `(code) => store.val(code, ctx)`. Defaults to () => 0
//  when no store is available (transform specs with inline data).
//
//  Analogue: Vega-Lite encoding block / Grafana field overrides layer.
//
export function applyEncoding(
  rows:   readonly EngineRow[],
  enc:    EncodingSpec,
  lookup: (code: string) => number = () => 0,
): DataRow[] {
  const negateSet  = new Set(enc.negate ?? [])
  const denomCache = new Map<string, number>()

  const sumOfField = enc.pct && 'sumOf' in enc.pct ? enc.pct.sumOf : null
  const sumOfTotal = sumOfField
    ? rows.reduce((s, o) => {
        if (enc.isTotal && o[enc.isTotal]) return s
        return s + Math.abs(Number(o[sumOfField] ?? 0))
      }, 0)
    : 0

  return rows.map((obs) => {
    const rawValue = Number(obs[enc.value ?? 'value'] ?? 0)
    const measure  = String(obs['measure'] ?? '')
    const value    = negateSet.has(measure) ? -rawValue : rawValue

    let pct: number | undefined
    if (enc.pct) {
      if ('sumOf' in enc.pct) {
        pct = sumOfTotal ? (Math.abs(value) / sumOfTotal) * 100 : undefined
      } else if ('field' in enc.pct) {
        pct = typeof obs[enc.pct.field] === 'number' ? Number(obs[enc.pct.field]) : undefined
      } else {
        if (!denomCache.has(enc.pct.of)) denomCache.set(enc.pct.of, lookup(enc.pct.of))
        const denom = denomCache.get(enc.pct.of)!
        pct = denom ? (Math.abs(value) / denom) * 100 : undefined
      }
    }

    const label  = String(obs[enc.label] ?? '')
    const series = enc.series ? String(obs[enc.series] ?? '') : undefined
    const autoId = series ? `${label}::${series}` : label
    const row: DataRow = {
      id:    enc.id && obs[enc.id] !== undefined ? String(obs[enc.id]) : autoId,
      label, series, value, pct,
      color: enc.color ? String(obs[enc.color] ?? '') : String(obs['color'] ?? '') || undefined,
    }
    if (enc.isSeparator && obs[enc.isSeparator])          row.isSeparator = true
    if (enc.isTotal     && obs[enc.isTotal])              row.isTotal     = true
    if (enc.level       && obs[enc.level] !== undefined)  row.level       = Number(obs[enc.level])
    if (enc.parentId    && obs[enc.parentId])             row.parentId    = String(obs[enc.parentId])
    return row
  })
}