// ── DataSpec — the platform-wide data-query vocabulary ────────────────
//
//  The central data-query discriminated union + the table/column/row/years
//  primitives it composes with. Used by EVERY data element (chart, table,
//  kpi, panel) — this is generic platform vocabulary, not section-specific.
//  100% JSON-serializable — every field is a plain value, no functions.
//  Constructor (phase 2) generates any of these without writing code.
//

import type { CtxRef, DimVal, ObsQuery } from '../sdmx'
import type { LocaleString }     from '../i18n/types'
import type { EncodingSpec }              from '../data/encoding'
import type { TransformStep }             from '../data/transform'
import type { GrainLevel, RollupOp }      from '../data/store'
import type { ValueMapping }              from './value-mapping'

// ── ColumnDef — one value column in a DataTable ───────────────────────
//
//  Eurostat/ONS pattern: tables declare their columns explicitly via JSON.
//  key references a DataRow field ('value', 'pct', or any custom field).
//  format references a FORMATTERS registry key (data/transform.ts).
//
export interface ColumnDef {
  key:     'value' | 'pct' | string
  label:   LocaleString
  format?: string
  width?:  string
  align?:  'l' | 'r'
  /**
   * Bar gauge for this column (Grafana / Metabase pattern).
   * true        → auto-scale: bar fills relative to max value in current data.
   * { max: 100} → fixed scale: useful for pre-computed pct columns (0–100).
   * Renders as an extra "bar" column appended after all value columns.
   * Only one bar column per table is supported; first match wins.
   */
  bar?: boolean | { min?: number; max?: number }
  /**
   * Declarative value → {text, token, icon} mapping for this column's cells
   * (Grafana value mappings, token-bound — see config/value-mapping.ts). When a
   * cell value matches a rule, the consumer renders the mapped text + icon, coloured
   * by the rule's semantic TOKEN (never a literal colour). Absent ⇒ raw formatted
   * value. a11y: the mapped TEXT carries the meaning, colour is decoration only.
   */
  valueMappings?: ValueMapping[]
}

// ── RowSpec — one entry in a row-list DataSpec ────────────────────────
export interface RowSpec {
  code:     string
  label?:   LocaleString
  color?:   string
  negate?:  boolean
  isTotal?: boolean
  pctOf?:   string
}

// ── YearsSpec ─────────────────────────────────────────────────────────
//
//  'all'     — renderer queries all distinct time values from the store.
//              observe() without a time filter returns every year in the data.
//              Phase 2: Constructor stores an explicit number[] in JSON.
//              Phase 1 convenience: configs use 'all' so they need no data imports.
//
//  number[]  — explicit year list. Constructor generates this from the datasource
//              time dimension catalogue. JSON-serializable.
//
export type YearsSpec = readonly number[] | 'all'

// ── timeDimension — FIRST-CLASS time concept [ADR R5] ─────────────────
//
//  Cube.dev `timeDimensions` / Looker / Power-BI parity: time gets ONE
//  canonical, granularity-aware shape instead of three scattered forms
//  (YearsSpec on timeseries/growth · fromDim/toDim range-clamp · time
//  buried in ObsQuery.filter). adr_data_reference_render_vision R5.
//
//  ADDITIVE + Postel: every legacy form still resolves byte-identically.
//  `timeDimension` is an ALTERNATIVE that the resolver normalizes into the
//  SAME (years + from/to-clamp) inputs the existing code already consumes —
//  one resolution path, no behaviour fork. When absent, nothing changes.
//
//  No privileged dimension (Law 1): `dim` is the GENERIC time-axis key.
//  Authors set it to the conventional time key (TIME_DIM, the SDMX
//  TIME_PERIOD SSOT in core/context.ts); the resolver pins/clamps via that
//  same SSOT, never a hardcoded literal.

/**
 * A single time-range BOUND. A literal year (number) OR a runtime ctx
 * reference (`{ $ctx: 'startYear' }`) resolved against ctx.dims at
 * interpret time — exactly mirroring the legacy fromDim/toDim ctx lookup,
 * so the `[from,to]` form folds those two loose fields byte-identically.
 */
export type TimeBound = number | CtxRef

/**
 * The time selection. Two forms, disambiguated by SHAPE:
 *   YearsSpec               — explicit year list / 'all' (folds `years`). A
 *                             tuple of two LITERAL numbers is a YearsSpec (it
 *                             SELECTS those years), not a clamp.
 *   [TimeBound, TimeBound]  — a [from,to] CLAMP, reserved for ctx-ref bounds
 *                             (`{ $ctx }`). This is the byte-identical fold
 *                             target of the legacy fromDim/toDim (which are
 *                             always ctx lookups). The clamp form is detected
 *                             when at least one bound is a `{ $ctx }` ref.
 */
export type TimeRange = YearsSpec | readonly [TimeBound, TimeBound]

/**
 * SDMX/Cube grain — an OPEN registry-resolved string (the `ChartType` open-string
 * precedent), NOT a closed union. Carried metadata (default-derived = year), inert at
 * the resolve seam until the grain axis lands (D-GRAIN). De-privileged per the
 * orthogonal-axis law (DESIGN-time-mode-decision §3.1 / D3): a custom grain is a
 * registration, never a core-type edit. Conventional values: 'year' | 'quarter' |
 * 'month' | 'week' | 'day' — but any registered grain id is valid (Law 8 / OCP).
 */
export type TimeGranularity = string

/**
 * timeDimension — the canonical, first-class time concept on a DataSpec.
 *
 *   dim          — GENERIC time-axis dimension key (Law 1). Set to the
 *                  conventional TIME_PERIOD key (TIME_DIM); resolved via the
 *                  TIME_DIM SSOT, never special-cased.
 *   range        — the selection: a YearsSpec (explicit list) OR a [from,to]
 *                  tuple. Folds YearsSpec + fromDim/toDim into one field.
 *   granularity  — the grain. Default = the current implicit grain (year), so
 *                  absent ⇒ byte-identical. Door for LOD/declared-granularity.
 *
 *  100% JSON-serializable — no functions. Constructor (phase 2) emits this
 *  verbatim (a time-dimension picker with granularity — door, not built here).
 */
export interface TimeDimensionSpec {
  dim:          string
  range?:       TimeRange
  granularity?: TimeGranularity
}

// ── DataSpec — discriminated union ────────────────────────────────────
//
//  'query'      — universal: ObsQuery + pipe + EncodingSpec. Any dimension, any store.
//  'row-list'   — explicit rows. Convenient shorthand for year-mode sections.
//  'timeseries' — single measure × time range.
//  'growth'     — YoY growth rates. Multi-code → pivot table.
//  'ratio-list' — each row = measure / denominator × 100.
//  'pivot'      — wide→long shorthand (sugar for transform + melt).
//  'transform'  — full declarative pipeline (Vega-Lite transform analogue).
//
//  All branches are 100% JSON-serializable and Constructor-authorable.
//  The SINGLE extension path is the resolver registry: to add a new capability,
//  `defaultRegistry.registerSpec(myResolver)` in app bootstrap (a new discriminant
//  = a new registered resolver, interpreter unchanged — true OCP, Law 8). There is
//  no second `custom`/`fn` escape hatch (a named function-pointer in config was a
//  Law-2 smell + a competing extension mechanism — removed, ENG-16).
//
export type DataSpec =
  | { type: 'query'
      query:    ObsQuery
      /**
       * Optional pipeline applied AFTER store.observe() and year-range clamp,
       * BEFORE encoding. Composable, dataset-agnostic ops — sort, filter, lookup,
       * group, concat, template, derive, aggregate, rollup, melt, rename, cast,
       * addField, select, join. Fully JSON-serializable.
       * (Grafana / Malloy / Cube.dev / Vega-Lite transform pattern.)
       */
      pipe?:    TransformStep[]
      encoding: EncodingSpec
      fromDim?: string
      toDim?:   string
      /**
       * First-class time concept [ADR R5]. ADDITIVE alternative to fromDim/toDim
       * — normalized into the SAME range clamp. Explicit fromDim/toDim win on
       * overlap (Postel). Absent ⇒ byte-identical.
       */
      timeDimension?: TimeDimensionSpec
      /**
       * Optional row cap for pagination (P2-1).
       * Constructor-authorable — JSON number, no functions.
       * When set, walkNode slices interpretSpec rows to this limit and records
       * totalRows + truncated on the NodeDataFrame for downstream consumers.
       * Absent or undefined → no limit applied.
       */
      rowLimit?: number
    }
  | { type: 'row-list';   rows: RowSpec[] }
  | { type: 'timeseries'; code: string; years: YearsSpec
      fromDim?: string
      toDim?:   string
      /**
       * First-class time concept [ADR R5]. ADDITIVE: supplies the year list
       * (range = YearsSpec) and/or the from/to clamp (range = [from,to] tuple)
       * when the legacy `years`/`fromDim`/`toDim` are absent. Explicit legacy
       * fields win on overlap (Postel). Absent ⇒ byte-identical.
       */
      timeDimension?: TimeDimensionSpec }
  | { type: 'growth';     code: string | string[]; years: YearsSpec
      fromDim?: string
      toDim?:   string
      /** First-class time concept [ADR R5]. See timeseries (additive, Postel). */
      timeDimension?: TimeDimensionSpec }
  | { type: 'ratio-list'; pairs: { code: string; denom: string; label?: string }[]; pipe?: TransformStep[] }
  | { type: 'pivot'
      rows:        Record<string, DimVal>[]
      keyField:    string
      valueFields: string[]
      colors?:     Record<string, string>
    }
  | { type: 'transform'
      source:   Record<string, DimVal>[]
      steps:    TransformStep[]
      encoding: EncodingSpec
    }

// ── PointSeriesSpec — INTERNAL store-aware lowering primitive (NOT public) ─────
//
//  The desugar TARGET for the val-cell convenience specs (timeseries → here; growth
//  via a window/derive `pipe` tail). It is the genuinely STORE-AWARE primitive the
//  pure `transform` pipe cannot be (transform has no store): it ENUMERATES a generic
//  `over` dimension's coordinates and fans out a `valAt` point read per coordinate
//  (storeValAt), emits one `{ id, label, value, pct }` row each, then runs `pipe`.
//
//  Mirrors how `joinByField` is the engine-internal underside of the authorable
//  `blend` — point-series is the internal underside of timeseries/growth. It is
//  DELIBERATELY NOT a `DataSpec` discriminant: authors use the friendly specs, so
//  point-series is never authored and stays ABSENT from DATASPEC_DISCRIMINANTS /
//  SPEC_CATALOG (no Constructor surface — the front-doors carry it). Resolved via the
//  registry by its string discriminant, like every other registered resolver.
//
//  100% data, no functions (Law 2). Generic over `over` (Law 1 — 'time', 'geo', …).
export interface PointSeriesSpec {
  type:    'point-series'
  /** Measure code read at each coordinate (a metric-id is resolved in the resolver). */
  code:    string
  /** The dimension whose coordinates are enumerated (Law 1 — generic; e.g. TIME_DIM). */
  over:    string
  /** Explicit coordinate list; absent ⇒ the store's distinct(over), ascending. */
  coords?: readonly DimVal[] | 'all'
  /** Fixed base coordinate merged into every read (e.g. a pinned geo). */
  at?:     Partial<Record<string, DimVal>>
  /** Generic per-dim grain / LOD, forwarded to valAt. */
  grain?:  Record<string, GrainLevel>
  /** Aggregation when one coordinate matches multiple finer cells (default 'sum'). */
  rollup?: RollupOp
  /**
   * Optional numeric range clamp on the enumerated coordinate — folds the legacy
   * fromDim/toDim + timeDimension via effectiveBounds (the SAME machinery the val-cell
   * specs used), so a clamped timeseries lowers byte-identically. Shape mirrors
   * LegacyTimeSpec inline (avoids a config↔core import cycle).
   */
  clamp?:  { fromDim?: string; toDim?: string; timeDimension?: TimeDimensionSpec }
  /** Tail pipeline (window / derive / …) applied to the emitted rows. */
  pipe?:   TransformStep[]
}

// ── ResolvableSpec — resolution-time union: public DataSpec + internal primitives ─
//
//  desugar lowers a `DataSpec` onto this; interpretSpec/extractRequirements/the
//  registry resolve it by string discriminant. The PUBLIC, author-facing vocabulary
//  stays exactly `DataSpec` — point-series never leaks into the Constructor surface.
export type ResolvableSpec = DataSpec | PointSeriesSpec

// ── TableConfig ───────────────────────────────────────────────────────
export interface TableConfig {
  colLabel?:    string
  columns?:     ColumnDef[]
  valueLabel?:  string
  color?:       string
  indent?:      boolean
  statusFlags?: boolean
  caption?:     string
  /** Per-column aggregate footer: col key → 'sum' | 'avg' | 'cagr' */
  footer?:      Record<string, 'sum' | 'avg' | 'cagr'>
  footerLabel?: string
  seriesFormat?: Record<string, string>
  seriesOrder?:  string[]
}
