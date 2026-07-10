// ── @statdash/charts — Public API ──────────────────────────────────────
//
//  Renderer-agnostic chart interpretation. Sits between @statdash/react
//  and @statdash/engine in the dependency arrow:
//    src → plugins → @statdash/react → @statdash/charts → @statdash/engine
//
//  A table-only / headless consumer of @statdash/engine never imports this
//  package, so chart interpretation code is never bundled (Layer 8.1 goal).
//

// ── Chart type definitions ─────────────────────────────────────────────
export type {
  ChartDef,
  AxisConfig,
  LegendConfig,
  TooltipConfig,
  ChartOutput,
  ChartGroup,
  ChartSeries,
  ChartDataPoint,
  AxisOutput,
  LegendOutput,
  TooltipOutput,
  AnnotationOutput,
} from './types'

// ── ChartType — re-exported from engine (primitive, lives in core) ────
export type { ChartType } from '@statdash/engine'

// ── Dispatch — ChartDef + DataRow[] → neutral ChartOutput ─────────────
export { interpretChart, placeholderOutput } from './interpret'

// ── Registry — Strategy + Plugin pattern ──────────────────────────────
export type { ChartInterpreter } from './registry'
export { ChartRegistry, chartRegistry } from './registry'

// ── Validation (Constructor-facing) ───────────────────────────────────
export { validateChartDef } from './validate'

// ── ChartEmitter — ChartOutput → SVG (pure, server-usable) ────────────
//
//  The second realizer of ChartOutput (the first is the client Apex adapter):
//  a pure, DOM-free SVG string emitter for export / SSR / thumbnails (Law 9
//  export-per-section). No React, no ApexCharts, no `window`.
//
export { emit, isEmittable, EMITTABLE_TYPES, EMIT_GAPS, EMIT_PALETTE, paletteAt, niceScale } from './emit'
export type { EmitOptions, NiceScale } from './emit'

// ── Built-in interpreter registration (side effect) ───────────────────
//
//  Importing this package registers all 13 built-in interpreters onto
//  chartRegistry. Listed in package.json "sideEffects" so bundlers keep it.
//
import './interpreters'
