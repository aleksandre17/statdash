// ── DataSpec — the platform-wide data-query vocabulary ────────────────
//
//  The central data-query discriminated union + the table/column/row/years
//  primitives it composes with. Used by EVERY data element (chart, table,
//  kpi, panel) — this is generic platform vocabulary, not section-specific.
//  100% JSON-serializable — every field is a plain value, no functions.
//  Constructor (phase 2) generates any of these without writing code.
//

import type { DimVal, ObsQuery } from '../sdmx'
import type { LocaleString }     from '../i18n/types'
import type { ModeId }                   from '../mode/types'
import type { EncodingSpec }              from '../data/encoding'
import type { TransformStep }             from '../data/transform'

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

// ── DataSpec — discriminated union ────────────────────────────────────
//
//  'query'      — universal: ObsQuery + pipe + EncodingSpec. Any dimension, any store.
//  'row-list'   — explicit rows. Convenient shorthand for year-mode sections.
//  'timeseries' — single measure × time range.
//  'growth'     — YoY growth rates. Multi-code → pivot table.
//  'ratio-list' — each row = measure / denominator × 100.
//  'by-mode'    — branch on timeMode.
//  'pivot'      — wide→long shorthand (sugar for transform + melt).
//  'transform'  — full declarative pipeline (Vega-Lite transform analogue).
//
//  All branches are 100% JSON-serializable and Constructor-authorable.
//  To add a custom resolver: `defaultRegistry.registerSpec(myResolver)` in app bootstrap.
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
      toDim?:   string }
  | { type: 'growth';     code: string | string[]; years: YearsSpec
      fromDim?: string
      toDim?:   string }
  | { type: 'ratio-list'; pairs: { code: string; denom: string; label?: string }[]; pipe?: TransformStep[] }
  | { type: 'by-mode';    modes: Record<ModeId, DataSpec> }
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
  | { type: 'custom'; fn: string; params?: Record<string, unknown> }

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
