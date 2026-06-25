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

import type { DimVal }           from '../sdmx'
import type { ProvenanceRecord } from '../core/provenance'

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

// ── Channel enrichment — Vega-Lite measurement type + join key (R2) ──────
//
//  Vega-Lite (and ECharts/G2/D3) channels carry MORE than a field name:
//    • a measurement `type` (quantitative / ordinal / nominal / temporal)
//      → refines scale/axis/number-format defaults (temporal → time axis, …)
//    • a stable `key` (the data-join identity) → stabilizes chart diffing /
//      animation across row updates (D3's key function).
//
//  Our field-bearing channels historically carried only a field NAME (a bare
//  string). R2 enriches them ADDITIVELY: a channel may now ALSO be an object
//  { field, type?, key? }. A bare string is exactly today's behavior — no
//  measurement type, no explicit key — so every stored config is byte-identical
//  (default-derived = current). 100% JSON-serializable (Law 2: strings, no fns).

/**
 * Vega-Lite measurement type (the channel's "level of measurement").
 * Refines scale/axis/format defaults when present; DERIVED from the data/field
 * (see `deriveMeasurementType`) when absent, reproducing current output exactly.
 */
export type MeasurementType = 'quantitative' | 'ordinal' | 'nominal' | 'temporal'

/**
 * Enriched channel definition — a field name PLUS optional Vega-Lite metadata.
 * Use the bare-string form for the byte-identical default; use this object form
 * to declare a measurement `type` and/or a stable data-join `key`.
 */
export interface ChannelDef {
  /** Which obs field this channel reads. */
  field: string
  /** Vega-Lite measurement type. Absent → default-derived (byte-identical). */
  type?: MeasurementType
  /** Stable data-join key field (D3 key function). Absent → positional/auto-id. */
  key?:  string
}

/**
 * A field-bearing encoding channel: a bare field name (today's form) OR an
 * enriched { field, type?, key? } object. Postel: liberal in what we accept.
 */
export type EncodingChannel = string | ChannelDef

/** Extract the field name from a channel (bare string OR ChannelDef). */
export function channelField(c: EncodingChannel | undefined): string | undefined {
  if (c === undefined) return undefined
  return typeof c === 'string' ? c : c.field
}

/** Extract the explicit measurement type, if the channel declares one. */
export function channelType(c: EncodingChannel | undefined): MeasurementType | undefined {
  return typeof c === 'object' && c ? c.type : undefined
}

/** Extract the explicit data-join key field, if the channel declares one. */
export function channelKey(c: EncodingChannel | undefined): string | undefined {
  return typeof c === 'object' && c ? c.key : undefined
}

/**
 * Default-derive a Vega-Lite measurement type from the field's runtime type +
 * role (the same (role, type) signal `fieldSchema.ts` already sniffs). This is
 * the byte-identical fallback used when a channel omits `type`: the renderer's
 * current behavior is exactly what these mappings reproduce.
 *
 *   time            → temporal     (time axis)
 *   measure/number  → quantitative (numeric scale + number format)
 *   boolean         → nominal      (categorical)
 *   string/unknown  → nominal      (categorical — today's default)
 *
 * `ordinal` is never auto-derived (it requires an author-declared ordering);
 * a channel that wants ordinal scale must say so explicitly via ChannelDef.type.
 */
export function deriveMeasurementType(
  fieldType: 'number' | 'string' | 'time' | 'boolean' | 'unknown',
  role:      'dimension' | 'measure' | 'meta' = 'dimension',
): MeasurementType {
  if (fieldType === 'time')                       return 'temporal'
  if (role === 'measure' || fieldType === 'number') return 'quantitative'
  return 'nominal'
}

/**
 * Resolve a channel's effective measurement type: the explicit `type` when the
 * channel declares one, else the default-derived type. Used by renderers that
 * want to refine scale/axis/format. For a bare-string channel this returns the
 * derived default → byte-identical with pre-R2 behavior.
 */
export function resolveMeasurementType(
  c:         EncodingChannel | undefined,
  fieldType: 'number' | 'string' | 'time' | 'boolean' | 'unknown',
  role:      'dimension' | 'measure' | 'meta' = 'dimension',
): MeasurementType {
  return channelType(c) ?? deriveMeasurementType(fieldType, role)
}

/**
 * Encoding spec — maps observation fields to DataRow visual channels.
 * Analogous to Vega-Lite's encoding object. 100% JSON-serializable.
 */
export interface EncodingSpec {
  // ── Primary channels ─────────────────────────────────────────────────
  //
  //  Field-bearing channels accept a bare field NAME (today's form) OR an
  //  enriched { field, type?, key? } (Vega-Lite parity). Bare string =
  //  byte-identical default; the object form carries measurement type + key.

  /** Which obs field becomes DataRow.label (x-axis label / table row label). */
  label:          EncodingChannel

  /** Which obs field becomes DataRow.value. Default: 'value'. */
  value?:         EncodingChannel

  /** Which obs field drives DataRow.color (explicit field, not auto-assigned). */
  color?:         EncodingChannel

  /**
   * Which obs field becomes DataRow.series — the grouping dimension.
   * Vega-Lite equivalent: 'color' / 'xOffset' channel.
   * When present → Chart renders multi-series, DataTable renders pivot columns.
   */
  series?:        EncodingChannel

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
   * p = preliminary   → badge 'P'
   * e = estimate       → badge 'E'
   * r = revised        → badge 'R'
   * c = confidential   → badge 'C'
   *
   * @deprecated Prefer `provenance.status` for new code.
   *   Kept for backward compatibility; `applyEncoding` continues to populate it.
   */
  status?:      'A' | 'p' | 'e' | 'r' | 'c'
  /**
   * Typed provenance record — superset of the `status` field.
   * Populated by the store layer (MetadataPort) or by `applyEncoding` when
   * the encoding includes a status field.  Absent when no provenance data
   * is available — renderers degrade gracefully.
   *
   * Reference: roadmap Layer 9.2 [N14].
   */
  provenance?:  ProvenanceRecord
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

  // Resolve enriched channels to their field names once. A bare-string channel
  // resolves to itself → byte-identical with the pre-R2 read sites below.
  const labelField  = channelField(enc.label)!            // label is required
  const valueField  = channelField(enc.value) ?? 'value'
  const colorField  = channelField(enc.color)
  const seriesField = channelField(enc.series)
  // Data-join key (D3 key function): the first field-bearing channel that
  // declares a `key`. When present it provides STABLE row identity across
  // updates. Absent on every channel → undefined → today's positional auto-id
  // (byte-identical). `enc.id` (an explicit id FIELD) still wins over this.
  const keyField =
    channelKey(enc.label)  ?? channelKey(enc.series) ??
    channelKey(enc.value)  ?? channelKey(enc.color)

  const sumOfField = enc.pct && 'sumOf' in enc.pct ? enc.pct.sumOf : null
  const sumOfTotal = sumOfField
    ? rows.reduce((s, o) => {
        if (enc.isTotal && o[enc.isTotal]) return s
        return s + Math.abs(Number(o[sumOfField] ?? 0))
      }, 0)
    : 0

  return rows.map((obs) => {
    const rawValue = Number(obs[valueField] ?? 0)
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

    const label  = String(obs[labelField] ?? '')
    const series = seriesField ? String(obs[seriesField] ?? '') : undefined
    const autoId = series ? `${label}::${series}` : label
    // Identity precedence: explicit `enc.id` field > channel `key` field >
    // positional auto-id. The `key` branch only fires when a channel declared
    // a key (no existing config does) → byte-identical default.
    const joinId =
      enc.id   && obs[enc.id]   !== undefined ? String(obs[enc.id])
    : keyField && obs[keyField] !== undefined ? String(obs[keyField])
    : autoId
    const row: DataRow = {
      id:    joinId,
      label, series, value, pct,
      color: colorField ? String(obs[colorField] ?? '') : String(obs['color'] ?? '') || undefined,
    }
    if (enc.isSeparator && obs[enc.isSeparator])          row.isSeparator = true
    if (enc.isTotal     && obs[enc.isTotal])              row.isTotal     = true
    if (enc.level       && obs[enc.level] !== undefined)  row.level       = Number(obs[enc.level])
    if (enc.parentId    && obs[enc.parentId])             row.parentId    = String(obs[enc.parentId])
    return row
  })
}