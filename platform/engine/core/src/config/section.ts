// ── Section Config Types ───────────────────────────────────────────────
//
//  DataSpec, ColumnDef, RowSpec, TableConfig, VisibilityExpr and the
//  methodology-link primitives — the live config vocabulary.
//  100% JSON-serializable — every field is a plain value, no functions.
//  Constructor (phase 2) generates any of these without writing code.
//

import type { DimVal, ObsQuery } from '../sdmx'
import type { LocaleString }     from '../i18n/types'
import type { ModeId }                   from '../mode/types'
import type { EncodingSpec }              from '../data/encoding'
import type { TransformStep }             from '../data/transform'
import type { SectionContext }            from '../core/context'

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

// ── VisibilityExpr — boolean expression tree ──────────────────────────
//
//  Evaluated by evalVisibility(expr, filterParams) in Page.tsx.
//  100% JSON-serializable → Constructor (phase 2) generates any combination.
//
export type VisibilityExpr =
  | { op: 'eq';       param: string; is: DimVal | null }
  | { op: 'neq';      param: string; is: DimVal | null }
  | { op: 'in';       param: string; values: DimVal[]  }
  | { op: 'isset';    param: string }
  | { op: 'and';      exprs: VisibilityExpr[] }
  | { op: 'or';       exprs: VisibilityExpr[] }
  | { op: 'not';      expr:  VisibilityExpr  }
  // Mode-aware ops — use ModeContext.current, not filterParams. Old { op:'eq', param:'mode' } still works.
  | { op: 'mode-is';  mode:  ModeId   }
  | { op: 'mode-in';  modes: ModeId[] }
  | { op: 'mode-not'; mode:  ModeId   }

// ── LinkDef — methodology / reference link primitive ──────────────────
//
//  Live: consumed by the `links` panel plugin (LinksNode.items: LinkDef[]).
//  LinkIconKey is also live — resolved to SVG via LINK_ICONS in @geostat/react.
//

/** Icon token for methodology links — renderer resolves to SVG via LINK_ICONS. */
export type LinkIconKey = 'doc' | 'info' | 'ext'

/** One methodology / reference link. */
export interface LinkDef {
  href:  string
  label: LocaleString
  icon:  LinkIconKey
}

// ── evalVisibility ────────────────────────────────────────────────────
//
//  Pure evaluator for VisibilityExpr boolean trees.
//  Called by Page.tsx to decide which sections to render.
//  Lives in engine — pure logic, zero React.
//
//  fr = PageFiltersResult cast to Record<string, unknown>.
//  undefined values normalised to null (no-selection state).
//
export function evalVisibility(
  expr: VisibilityExpr,
  fr:   Record<string, unknown>,
  mode?: ModeId,
): boolean {
  switch (expr.op) {
    case 'eq':       return (fr[expr.param] ?? null) === expr.is
    case 'neq':      return (fr[expr.param] ?? null) !== expr.is
    case 'in':       return expr.values.includes(fr[expr.param] as (typeof expr.values)[0])
    case 'isset':    { const v = fr[expr.param]; return v !== undefined && v !== null && v !== '' }
    case 'and':      return expr.exprs.every((e) => evalVisibility(e, fr, mode))
    case 'or':       return expr.exprs.some((e)  => evalVisibility(e, fr, mode))
    case 'not':      return !evalVisibility(expr.expr, fr, mode)
    case 'mode-is':  return mode != null && mode === expr.mode
    case 'mode-in':  return mode != null && expr.modes.includes(mode)
    case 'mode-not': return mode != null && mode !== expr.mode
  }
}

// ── resolveTemplate ───────────────────────────────────────────────────
//
//  Resolve a template string against SectionContext.
//  '{time} · მლნ ₾' + ctx.dims.time=2024 → '2024 · მლნ ₾'
//
//  Still accepts { year, range } union for PageDef.badge compatibility.
//  Caller should resolve LocaleString via useResolveLocale() before passing
//  here (string branch passes through unchanged).
//
export function resolveTemplate(
  tpl:    string | { year: string; range: string },
  ctx:    SectionContext,
  extras?: Record<string, unknown>,
): string {
  const str = typeof tpl === 'string' ? tpl : (ctx.timeMode === 'year' ? tpl.year : tpl.range)
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    if (extras && key in extras) return String(extras[key] ?? `{${key}}`)
    return String(ctx.dims[key] ?? `{${key}}`)
  })
}