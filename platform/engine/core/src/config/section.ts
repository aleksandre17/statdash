// ── Section Config Types ───────────────────────────────────────────────
//
//  SectionDef and all related config types.
//  100% JSON-serializable — every field is a plain value, no functions.
//  Constructor (phase 2) generates any SectionDef without writing code.
//

import type { DimVal, ObsQuery } from '../sdmx'
import type { ModeId }                   from '../mode/types'
import type { EncodingSpec, DataRow }     from '../data/encoding'
import type { TransformStep }             from '../data/transform'
import type { SectionContext }            from '../core/context'
import type { ChartDef }                  from '../chart/types'
import type { KpiSpec }                   from '../data/kpi'
import { groupBySpan }                    from '../core/layout'
import type { TabsMap }                   from '../core/layout'

// ── ColumnDef — one value column in a DataTable ───────────────────────
//
//  Eurostat/ONS pattern: tables declare their columns explicitly via JSON.
//  key references a DataRow field ('value', 'pct', or any custom field).
//  format references a FORMATTERS registry key (data/transform.ts).
//
export interface ColumnDef {
  key:     'value' | 'pct' | string
  label:   string
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
  label?:   string
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
//  'custom'     — escape hatch. fn returns DataRow[] directly.
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
  | { type: 'custom'; fn: (ctx: SectionContext) => DataRow[] }

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

// ── SectionView — one self-contained view slot ────────────────────────
//
//  The unit of content inside a section.
//  Grafana panel query+transform+display as a named slot.
//  Builder.io content block — fully self-contained, no cross-slot references.
//
//  When used inside SectionDef.tabs.views, each key = a filter param value.
//  When used as SectionDef.view, it is the sole unconditional view.
//
export interface SectionView {
  /** Subtitle text — may contain {dim} placeholders. resolveTemplate() at render. */
  subtitle?: string
  /** Data specification — what to fetch/compute. */
  data?:     DataSpec
  /** Chart definition — how to visualise the data. */
  chart?:    ChartDef
  /** Table configuration — how to display the data. */
  table?:    TableConfig
}

// ── SectionDef ────────────────────────────────────────────────────────
//
//  100% JSON-serializable. No year/range parallel universe — use tabs.views.
//
//  Visibility:
//    visibleWhen — explicit VisibilityExpr for complex conditions
//    tabs.views  — section auto-hides when active param value has no view
//
//  View selection (Grafana template variable → panel content pattern):
//    tabs.views[filterParams[tabs.param]]  → active SectionView
//    view                                  → unconditional SectionView (no tabs)
//
export interface SectionDef {
  type:          'section'
  id:            string
  title:         string
  color:         string
  defaultOpen?:  boolean
  noCollapse?:   boolean
  hero?:         boolean
  exportable?:   boolean
  visibleWhen?:  VisibilityExpr
  /** Label prepended above the section card. May contain {dim} placeholders. */
  prependLabel?: string
  /**
   * Layout height of the section column.
   * 'auto'  — content-driven (default)
   * 'sm' / 'md' / 'lg' / 'xl' — fixed pixel heights (280 / 380 / 480 / 600 px)
   * '16:9' / '4:3' / '1:1'   — aspect-ratio (responds to column width)
   */
  height?: 'auto' | 'sm' | 'md' | 'lg' | 'xl' | '16:9' | '4:3' | '1:1'
  /**
   * Layout width within the 12-column page grid.
   * 'full' (default) / 'half' / 'third'
   * Renderer places; groupWidgetsByWidth() groups AFTER visibility filtering.
   */
  width?:  'full' | 'half' | 'third'

  /**
   * Param-driven view switch (Grafana template variable / Builder.io tabs pattern).
   *
   *   param  — any filter key: 'mode', 'sector', 'region', ...
   *   views  — TabsMap<SectionView>: key = param value, value = content slot
   *
   * Renderer: views[filterParams[param]] → active SectionView.
   * Section is auto-hidden when the active param value is absent from views.
   *
   * Replaces: chart: { year, range }, table: { year, range },
   *           subtitle: { year, range }, data: { type: 'by-mode' }, visibleIn.
   */
  tabs?: {
    param: string
    views: TabsMap<SectionView>
  }

  /**
   * Unconditional view — used when section has no tabs dependency.
   * For sections that are always visible with a single data source.
   */
  view?: SectionView
}

// ── TabsDef — widget that renders a tabbed view ───────────────────────
//
//  Builder.io / Retool pattern: tabs as an array of content slots.
//  param references a filter key whose value drives the active tab.
//  widgets inside each TabEntry are recursive — full WidgetDef[] nesting.
//
export interface TabEntry {
  key:     string
  label?:  string
  widgets: WidgetDef[]
}

export interface TabsDef {
  type:  'tabs'
  id:    string
  /** Filter param key that drives the active tab (must be a string value) */
  param: string
  tabs:  TabEntry[]
}

// ── Page-level widget primitives ─────────────────────────────────────
//
//  Pure-data counterparts to the React components that render them.
//  Each type maps 1:1 to a React component in @geostat/react.
//  Adding a new widget: define interface here → add renderer in Page.tsx.
//
//  Builder.io component registry pattern: type → renderer.
//  Retool/AppSmith: every canvas element is a typed widget.
//  Grafana: every panel has a panel type (text, graph, table, …).
//

/** Page title, breadcrumbs, badge — the top-of-page identity block. */
export interface PageHeaderDef {
  type:    'page-header'
  title:   string
  /** Badge text — may contain {dim} placeholders. resolveTemplate() at render. */
  badge?:  string | { year: string; range: string }
  /** Static breadcrumb trail — overridden by _pageCrumbs derive at runtime. */
  crumbs?: { label: string; href?: string }[]
}

/** Filter bar marker — schema lives in PageDef.filterSchema, not here. */
export interface FilterBarDef {
  type: 'filter-bar'
}

/** KPI strip — interpretKpis(kpis, ctx, store) at render time. */
export interface KpiStripDef {
  type: 'kpi-strip'
  kpis: KpiSpec[]
}

/** Icon token for methodology links — renderer resolves to SVG via LINK_ICONS. */
export type LinkIconKey = 'doc' | 'info' | 'ext'

/** One methodology / reference link. */
export interface LinkDef {
  href:  string
  label: string
  icon:  LinkIconKey
}

/** Footer methodology links row. */
export interface LinksDef {
  type:  'links'
  links: LinkDef[]
}

// ── WidgetDef — discriminated union of all widget types ───────────────
//
//  PageDef.children: WidgetDef[]  — the full content tree.
//  Recursive: TabsDef.tabs[].widgets: WidgetDef[] nests any widget type.
//
//  Extending the platform:
//    1. Add interface with a unique `type` literal here
//    2. Add renderer case in Page.tsx
//    Zero other changes needed.
//
//  Builder.io / Retool / Grafana: type is the dispatch key.
//
export type WidgetDef =
  | PageHeaderDef
  | FilterBarDef
  | KpiStripDef
  | SectionDef
  | TabsDef
  | LinksDef

// ── groupSectionsByWidth ───────────────────────────────────────────────
//
//  SectionDef-specific application of the generic groupBySpan algorithm.
//  Thin boundary wrapper: knows only the SectionDef → span mapping.
//  The packing algorithm itself lives in core/layout.ts — type-agnostic.
//
//  "Generic algorithm in core; specific application at the boundary." (DIP)
//
const SECTION_COLS: Record<NonNullable<SectionDef['width']>, number> = {
  full: 12, half: 6, third: 4,
}

export function groupSectionsByWidth(sections: SectionDef[]): SectionDef[][] {
  return groupBySpan(sections, (s) => SECTION_COLS[s.width ?? 'full'] ?? 12)
}

// ── groupWidgetsByWidth ────────────────────────────────────────────────
//
//  WidgetDef variant of groupSectionsByWidth.
//  TabsDef always spans the full 12 columns (never side-by-side).
//  SectionDef delegates to SECTION_COLS as before.
//
export function groupWidgetsByWidth(widgets: WidgetDef[]): WidgetDef[][] {
  return groupBySpan(widgets, (w) => {
    if (w.type === 'tabs')    return 12
    if (w.type === 'section') return SECTION_COLS[w.width ?? 'full'] ?? 12
    return 12  // non-layout types — full width (renderChildren pre-filters these out)
  })
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
//  SectionView.subtitle and SectionDef.prependLabel are plain strings.
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