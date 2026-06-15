// ── @geostat/charts — Public API ──────────────────────────────────────
//
//  Renderer-agnostic chart interpretation. Sits between @geostat/react
//  and @geostat/engine in the dependency arrow:
//    src → plugins → @geostat/react → @geostat/charts → @geostat/engine
//
//  A table-only / headless consumer of @geostat/engine never imports this
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
export type { ChartType } from '@geostat/engine'

// ── Dispatch — ChartDef + DataRow[] → neutral ChartOutput ─────────────
export { interpretChart, placeholderOutput } from './interpret'

// ── Registry — Strategy + Plugin pattern ──────────────────────────────
export type { ChartInterpreter } from './registry'
export { ChartRegistry, chartRegistry } from './registry'

// ── Validation (Constructor-facing) ───────────────────────────────────
export { validateChartDef } from './validate'

// ── Built-in interpreter registration (side effect) ───────────────────
//
//  Importing this package registers all 13 built-in interpreters onto
//  chartRegistry. Listed in package.json "sideEffects" so bundlers keep it.
//
import './interpreters'
