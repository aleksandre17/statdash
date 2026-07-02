// ── Chart System — Type Definitions ───────────────────────────────────
//
//  Two type families:
//    ChartDef  — what config authors write (JSON-serializable)
//    ChartOutput — what the engine produces (renderer-agnostic)
//
//  ChartOutput is the NEUTRAL format. It knows nothing about ApexCharts,
//  D3, Recharts, or SVG. The React adapter converts ChartOutput → ApexOptions.
//
//  Separation means:
//    swap ApexCharts → Recharts  = change apexAdapter.ts only
//    add PDF export              = add pdfAdapter.ts
//    add server-side PNG         = add canvasAdapter.ts
//    zero engine changes in all cases.
//
//  Pattern: Grafana PanelData → each panel plugin renders the same neutral data.
//

import type { ChartType, FieldConfig } from '@statdash/engine'

// ── ChartDef — enriched chart specification ───────────────────────────
//
//  ChartDef is what config authors write (JSON-serializable).
//  interpretChart() reads ChartDef + DataRow[] and produces ChartOutput.
//
//  Design: Vega-Lite mark + encoding analogue.
//  ChartType = the mark. fieldConfig + axes = the encoding overrides.
//
export interface ChartDef {
  /** Visual type — determines which ChartInterpreter handles this def. */
  type:         ChartType
  /** Human-readable label shown in chart header / placeholder. */
  label:        string
  /** Chart height in pixels. Default: 300. */
  height?:      number
  /** Per-field display settings: units, decimals, thresholds, color mode. */
  fieldConfig?: FieldConfig
  /** Axis configuration overrides. */
  axes?: {
    x?: AxisConfig
    y?: AxisConfig
    /** Second Y-axis for combo charts (bar + line with different scales). */
    y2?: AxisConfig
  }
  /** Legend configuration. */
  legend?: LegendConfig
  /** Tooltip configuration. */
  tooltip?: TooltipConfig
  /**
   * hbar-diverging only: collapse two series into one, showing only the
   * active bar per row (no wasted space for the empty side).
   * Each bar retains its original series color via per-point fillColor.
   */
  compact?: boolean
  /** Stack multiple series on top of each other (bar charts only). */
  stacked?: boolean
  /**
   * Categorical color-by-category for a SINGLE-series bar/hbar: each bar draws
   * the next hue from the platform categorical palette (--chart-color-N SSOT),
   * so a region/sector comparison reads by category without inventing a colour
   * list. Per-point semantic colour (DataRow.color) still wins when present.
   * No-op for multi-series charts (series already carry their own colours).
   */
  distributed?: boolean
  /** Show value labels on top of bars. Default: true for bar/hbar. */
  dataLabels?: boolean
  /** Text shown below the center value in donut charts (e.g. 'მშპ'). */
  centerLabel?: string
}

// ── Axis configuration ────────────────────────────────────────────────

export interface AxisConfig {
  /** Unit label shown on the axis (e.g. 'მლნ ₾', '%'). */
  unit?:     string
  decimals?: number
  min?:      number
  max?:      number
  /** Hide the axis entirely. */
  hidden?:   boolean
}

export interface LegendConfig {
  show?:     boolean
  position?: 'top' | 'bottom' | 'right' | 'left'
}

export interface TooltipConfig {
  /** 'multi' = shared tooltip (all series); 'single' = per-series; 'none' = disabled */
  mode?: 'multi' | 'single' | 'none'
}

// ── ChartGroup — parent category for grouped axis charts ─────────────
//
//  Used by hbar-diverging and any future chart that needs an n-level
//  categorical axis. Groups are ordered and non-overlapping; the engine
//  strips group-header separator rows from the series data and encodes
//  the hierarchy here. Renderers use this to draw group header rows,
//  indented item labels, and divider lines between groups.
//
export interface ChartGroup {
  readonly label:  string
  readonly color:  string
  /** Number of data rows (categories) that belong to this group. */
  readonly length: number
}

// ── ChartOutput — neutral, renderer-agnostic format ───────────────────
//
//  Produced by ChartInterpreter.interpret().
//  Consumed by renderer adapters (apex, svg, canvas, etc.).
//  100% serializable → can be sent over the wire, logged, tested.
//
export interface ChartOutput {
  readonly type:       ChartType
  readonly height?:    number
  readonly categories: readonly string[]
  readonly series:     readonly ChartSeries[]
  readonly axes: {
    readonly x: AxisOutput
    readonly y: AxisOutput
    readonly y2?: AxisOutput
  }
  readonly stacked:    boolean
  readonly horizontal: boolean
  readonly legend:     LegendOutput
  readonly tooltip:    TooltipOutput
  readonly annotations: readonly AnnotationOutput[]
  /** Parent category groups for n-level grouped axis (hbar-diverging etc.). */
  readonly groups?: readonly ChartGroup[]
  /** Rollup total value — donut center label, passed from isTotal row by PieInterpreter. */
  readonly total?: number
  /** Text shown below the center value in donut charts. */
  readonly centerLabel?: string
  /** hbar-diverging compact mode: zero-value series slots are hidden and take no space. */
  readonly compact?: boolean
  /** Override for data-label visibility. Undefined = default (true for bar/hbar, false otherwise). */
  readonly dataLabels?: boolean
  /** Single-series bar/hbar: paint each category from the categorical palette SSOT. */
  readonly distributed?: boolean
}

export interface ChartSeries {
  /**
   * Series legend name — a RESOLVED, single-locale string by construction, NOT a
   * LocaleString. ChartOutput is the neutral, locale-AGNOSTIC format (Law 1/4): every
   * i18n carrier is collapsed to the active locale UPSTREAM of interpretChart —
   *   • a data-derived series name (`row.series`) at the React resolveRowLocales
   *     boundary (its authored `{ ka, en }` bag is tagged by the transform ops that
   *     inject it — see core/data/transform/steps.ts tagCell), and
   *   • a def-derived series name (`def.label`) at resolveChartDefLocale.
   * Widening this to LocaleString would push a raw `{ ka, en }` bag back INTO the
   * neutral output and out through toApexOptions — the exact "[object Object]" leak
   * localeChartDef.ts eliminated. Keep it a resolved string.
   */
  readonly name:        string
  readonly data:        readonly ChartDataPoint[]
  readonly color:       string
  readonly seriesType?: 'bar' | 'line'
  readonly yAxis?:      'y' | 'y2'
}

export interface ChartDataPoint {
  readonly value:          number
  readonly formatted:      string
  readonly thresholdColor?: string
  readonly status?:         'p' | 'e' | 'r' | 'c'
}

export interface AxisOutput {
  readonly unit?:        string
  readonly decimals?:    number
  readonly min?:         number
  readonly max?:         number
}

export interface LegendOutput {
  readonly show:      boolean
  readonly position?: 'top' | 'bottom' | 'right' | 'left'
}

export interface TooltipOutput {
  /** Whether tooltip is shown at all */
  readonly show:    boolean
  /** Override for shared mode; undefined = use chart-type default */
  readonly shared?: boolean
}

export interface AnnotationOutput {
  readonly axis:   'x' | 'y'
  readonly value:  number
  readonly label?: string
  readonly color?: string
}
