# chart-def.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — ChartDef: Grammar of Graphics encoding + ApexCharts bridge
 *
 * Demonstrates:
 * - ChartDef structure: type + open encoding record
 * - FieldEncoding per channel (x, y, color, label, tooltip, ...)
 * - Open encoding: [channel: string] — add channels freely, no code change
 * - interpretChart(def, rows, ctx) → ChartOutput → toApexOptions() → ApexCharts
 * - Common chart patterns: timeseries, bar, grouped, pie
 */

import type { ChartDef, ChartNode, DataRow } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// ChartDef — Grammar of Graphics (Vega-Lite pattern)
// ═══════════════════════════════════════════════════════════════════════════
//
// Separation: data (DataSpec on NodeBase) vs rendering (ChartDef on ChartNode.def)
// DataSpec → interpretSpec → ctx.rows → ChartDef → interpretChart → ChartOutput
//
// encoding is an OPEN RECORD — known channels documented, add any channel freely:
//   x, y, color, label, size, tooltip — documented
//   [channel: string] — anything else (opacity, angle, radius, shape...)
//
// interpretChart() reads the channels it understands, ignores unknown ones.
// New channel support = update interpretChart(), not ChartDef type.


// ── Timeseries line chart ─────────────────────────────────────────────────

const timeseriesChart: ChartDef = {
  type: 'line',
  encoding: {
    x: { field: 'time',  type: 'temporal',      title: 'წელი' },
    y: { field: 'value', type: 'quantitative',   title: 'მლნ ლარი', format: '#,##0' },
  },
}

// ChartNode in page config:
const timeseriesChartNode: ChartNode = {
  type: 'chart',
  data: {
    type:      'timeseries',
    indicator: 'B1G',
    dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
  },
  def: timeseriesChart,
}


// ── Grouped bar chart (multi-series) ─────────────────────────────────────

const groupedBarChart: ChartDef = {
  type:    'bar',
  stacked: false,
  encoding: {
    x:     { field: 'time',      type: 'ordinal',       title: 'წელი' },
    y:     { field: 'value',     type: 'quantitative',   title: 'მლნ ლარი', format: '#,##0' },
    color: { field: 'sector',    type: 'nominal',        title: 'სექტორი' },
    label: { field: 'value',     type: 'quantitative',   format: '#,##0' },
  },
  legend: true,
}


// ── Stacked bar chart ─────────────────────────────────────────────────────

const stackedBarChart: ChartDef = {
  type:    'bar',
  stacked: true,
  encoding: {
    x:     { field: 'time',    type: 'ordinal' },
    y:     { field: 'value',   type: 'quantitative', format: '#,##0.0' },
    color: { field: 'account', type: 'nominal',      title: 'ანგარიში' },
  },
  legend: true,
}


// ── Pie / donut chart ─────────────────────────────────────────────────────

const pieChart: ChartDef = {
  type: 'pie',
  encoding: {
    color: { field: 'sector', type: 'nominal', title: 'სექტორი' },
    y:     { field: 'value',  type: 'quantitative', format: '#,##0.0%' },
    label: { field: 'sector', type: 'nominal' },
  },
  legend: true,
}


// ── Area chart with tooltip override ─────────────────────────────────────

const areaChart: ChartDef = {
  type: 'area',
  encoding: {
    x:       { field: 'time',  type: 'temporal' },
    y:       { field: 'value', type: 'quantitative', format: '#,##0' },
    tooltip: { field: 'label', type: 'nominal' },   // tooltip shows label, not raw value
  },
}


// ── Open encoding — custom channel example ────────────────────────────────
//
// Add any channel without changing ChartDef type.
// interpretChart() ignores unknown channels — forward-compatible.

const bubbleChart: ChartDef = {
  type: 'scatter',
  encoding: {
    x:       { field: 'gdp_per_capita', type: 'quantitative', title: 'მშპ სულ. (ლარი)' },
    y:       { field: 'growth_rate',    type: 'quantitative', title: 'ზრდის ტემპი (%)' },
    size:    { field: 'population',     type: 'quantitative' },
    color:   { field: 'region',         type: 'nominal' },
    label:   { field: 'region',         type: 'nominal' },
    opacity: { field: 'confidence',     type: 'quantitative' },  // custom channel ✅
  },
}


// ═══════════════════════════════════════════════════════════════════════════
// interpretChart → ChartOutput → toApexOptions pipeline
// ═══════════════════════════════════════════════════════════════════════════
//
// ChartDef is the JSON-serializable declaration.
// interpretChart() translates ChartDef + DataRow[] → ChartOutput (intermediate).
// toApexOptions() translates ChartOutput → ApexCharts.ApexOptions (library-specific).
//
// Swap chart library? Only toApexOptions() changes. ChartDef: zero changes.

// engine/core/chart/interpretChart.ts:
//   function interpretChart(def: ChartDef, rows: DataRow[], ctx: RenderContext): ChartOutput
//
// engine/core/chart/toApexOptions.ts:
//   function toApexOptions(output: ChartOutput): ApexCharts.ApexOptions
//
// ChartRenderer (engine/react/):
//   const output = interpretChart(node.def, ctx.rows)  ← pure, no ctx needed
//   const Shell  = ctx.theme.shells['chart']
//   return <Shell def={node} output={output} />
//
// ChartShell (src/) — calls toApexOptions itself (library-specific, src/ boundary):
//   function GeostatChartShell({ def, output }: ChartShellProps) {
//     const apexOpts = toApexOptions(output)   ← src/shared/chart/toApexOptions.ts
//     return <ReactApexChart options={apexOpts} series={apexOpts.series} />
//   }


// ═══════════════════════════════════════════════════════════════════════════
// Why open encoding, not closed
// ═══════════════════════════════════════════════════════════════════════════
//
// ❌ Closed (narrowing):
//   encoding: {
//     x?: FieldEncoding; y?: FieldEncoding; color?: FieldEncoding
//     // tooltip? opacity? angle? radius? → impossible without type change
//   }
//
// ✅ Open (our approach):
//   encoding: {
//     x?: FieldEncoding; y?: FieldEncoding; color?: FieldEncoding  // documented
//     [channel: string]: FieldEncoding | undefined                  // free extension
//   }
//
// New chart library supports 'angle' channel for pie?
//   → Add { angle: { field: 'value' } } to encoding. Zero type changes.
//   → interpretChart() reads 'angle' if it understands it, ignores otherwise.


// ═══════════════════════════════════════════════════════════════════════════
// G-3 — interpretChart implementation pattern (Grafana PanelData → IR)
// ═══════════════════════════════════════════════════════════════════════════
//
// Grafana: PanelPlugin → PanelData IR → library adapter
// GoG mapping:
//   encoding.x     → categories   (temporal/ordinal axis)
//   encoding.y     → series.data  (quantitative values, null = missing obs)
//   encoding.color → series grouping (nominal → one series per unique value)
//   encoding.label → data label field (passed into ChartOutput.labelField)
//   encoding.tooltip → tooltip override field
//
// Rule: interpretChart is a PURE function — no side effects, no React, no store calls.
//       Receives pre-resolved rows from engine (ctx.rows). Never calls interpretSpec.

// engine/core/src/chart/interpretChart.ts:

function interpretChart_example(
  def:  ChartDef,
  rows: DataRow[],
): ChartOutput {

  const xEnc     = def.encoding['x']
  const yEnc     = def.encoding['y']
  const colorEnc = def.encoding['color']

  // ── Categories — x axis values (distinct, ordered) ───────────────────
  const xField = xEnc?.field ?? 'time'
  const categories: (string | number)[] = [
    ...new Set(rows.map(r => r[xField] as string | number)),
  ]

  // ── Series grouping ───────────────────────────────────────────────────
  //  color field present → group by color field → one series per unique value
  //  color field absent  → single series (all rows)
  const yField = yEnc?.field ?? 'value'
  let series: ChartSeries[]

  if (colorEnc?.field) {
    const colorField = colorEnc.field
    // unique group values in order of first appearance
    const groups = [...new Set(rows.map(r => r[colorField] as string))]

    series = groups.map(groupVal => {
      const data = categories.map(cat => {
        const row = rows.find(
          r => r[xField] === cat && r[colorField] === groupVal,
        )
        // null = missing observation → chart library renders gap (no interpolation)
        return row != null ? (row[yField] as number) : null
      })
      return { name: groupVal, data }
    })
  } else {
    // Single series — value per category
    const data = categories.map(cat => {
      const row = rows.find(r => r[xField] === cat)
      return row != null ? (row[yField] as number) : null
    })
    series = [{ name: yEnc?.title ?? yField, data }]
  }

  return {
    type:       def.type,
    series,
    categories,
    stacked:    def.stacked,
    legend:     def.legend,
  }
}

// Null observation rule:
//   null in series.data → ApexCharts renders a gap (connectNulls: false default)
//   This is the correct statistical behaviour — do NOT interpolate missing data.
//
// Missing observation vs zero:
//   0   = "the value is zero"  (valid, renders a zero bar/point)
//   null = "no observation"    (renders gap — statistically honest)
//
// Example — timeseries with gap at 2020 (COVID data break):
//   categories: [2019, 2020, 2021, 2022]
//   series[0].data: [142.3, null, 128.7, 156.1]
//                          ↑ gap rendered, not interpolated


// ── ChartDef → interpretChart → toApexOptions integration ────────────────
//
// Full call chain in ChartRenderer:
//
//   function ChartRenderer(node: ChartNode, ctx: RenderContext): ReactNode {
//     const output  = interpretChart(node.def, ctx.rows)
//     const options = toApexOptions(output)
//     return <ChartShell def={node} output={output} options={options} />
//   }
//
// toApexOptions translates ChartOutput → ApexCharts.ApexOptions:
//   output.series     → options.series (directly)
//   output.categories → options.xaxis.categories
//   output.stacked    → options.chart.stacked
//   output.type       → options.chart.type
//
// Library swap (e.g. Recharts):
//   Write toRechartsProps(output: ChartOutput): RechartsProps
//   interpretChart stays identical — ChartOutput is the stable IR.


// ── Type declarations (belong in all-types.ts, shown here for reference) ─

type ChartDef = {
  type:      string
  stacked?:  boolean
  legend?:   boolean
  encoding:  { x?: FieldEncoding; y?: FieldEncoding; color?: FieldEncoding; label?: FieldEncoding; tooltip?: FieldEncoding; [ch: string]: FieldEncoding | undefined }
}

type FieldEncoding = {
  field:   string
  type?:   'quantitative' | 'ordinal' | 'nominal' | 'temporal'
  title?:  string
  format?: string
}

type ChartSeries = {
  name: string
  data: (number | null)[]    // null = missing observation — never interpolate
}

type ChartOutput = {
  type:        string
  series:      ChartSeries[]
  categories?: (string | number)[]
  title?:      string
  stacked?:    boolean
  legend?:     boolean
}

// (DataRow is Record<string,unknown> with at minimum { indicator, value, time, geo })
```
