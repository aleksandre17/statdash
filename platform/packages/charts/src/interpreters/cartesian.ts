// ── Cartesian Chart Interpreters ──────────────────────────────────────

import type { DataRow, ChartType } from '@statdash/engine'
import { formatFieldValue, resolveFieldConfig } from '@statdash/engine'
import type { ChartDef, ChartOutput, ChartSeries } from '../types'
import type { ChartInterpreter } from '../registry'
import { buildDataPoint, buildAxes, buildLegend, buildTooltip, groupBySeries, uniqueLabels } from './shared'
import { DEFAULT_SERIES_COLOR } from '../colors'

// ── BarInterpreter (handles 'bar' and 'hbar') ─────────────────────────

class BarInterpreter implements ChartInterpreter {
  readonly type: ChartType
  constructor(type: ChartType = 'bar') { this.type = type }

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const chartRows  = rows.filter((r) => !r.isTotal && !r.isSeparator)
    const grouped    = groupBySeries(chartRows, def.label)
    const seriesKeys = [...grouped.keys()]
    const fc         = def.fieldConfig
    const categories = uniqueLabels(chartRows)

    const series: ChartSeries[] = seriesKeys.map((name) => {
      const seriesRows  = grouped.get(name)!
      const resolved    = resolveFieldConfig(fc, name)
      const rowsByLabel = new Map(seriesRows.map((r) => [r.label, r]))
      return {
        name,
        data:  categories.map((lbl) => {
          const r = rowsByLabel.get(lbl)
          return r ? buildDataPoint(r, resolved) : { value: 0, formatted: formatFieldValue(0, resolved) }
        }),
        color: seriesRows[0]?.color || DEFAULT_SERIES_COLOR,
      }
    })

    // Color-by-series (Grammar-of-Graphics): >1 series and NONE carries an explicit
    // semantic colour → the render layer paints each series a distinct categorical hue
    // by index (theme-aware). Detected here (information expert) so the render layer
    // stays a pure applier and never has to guess "is this the grey no-colour seed?".
    // A single explicit series colour (side/threshold encoding) opts the chart out —
    // those colours are meaning and must win.
    const anyExplicitSeriesColor = seriesKeys.some((name) => !!grouped.get(name)![0]?.color)

    return {
      type: this.type, height: def.height, categories, series,
      axes: buildAxes(def), stacked: def.stacked ?? false, horizontal: this.type === 'hbar',
      legend: buildLegend(def, series.length),
      tooltip: buildTooltip(def, this.type !== 'hbar'),
      annotations: [],
      ...(def.dataLabels !== undefined ? { dataLabels: def.dataLabels } : {}),
      // Categorical color-by-category only applies to a lone series — a multi-series
      // chart already distinguishes bars by series colour, so the flag is inert there.
      ...(def.distributed && series.length === 1 ? { distributed: true } : {}),
      ...(series.length > 1 && !anyExplicitSeriesColor ? { seriesColorByIndex: true } : {}),
      ...(def.palette ? { palette: def.palette } : {}),
      // x-range navigation intent passes through untouched (line/area inherit via
      // the spread below). Absent ⇒ omitted → byte-identical output (Postel).
      ...(def.rangeSlider ? { rangeSlider: true } : {}),
    }
  }
}

// ── LineInterpreter ────────────────────────────────────────────────────

class LineInterpreter implements ChartInterpreter {
  readonly type = 'line' as const
  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const out = new BarInterpreter('line' as ChartType).interpret(def, rows)
    return { ...out, type: 'line', horizontal: false }
  }
}

// ── AreaInterpreter ────────────────────────────────────────────────────

class AreaInterpreter implements ChartInterpreter {
  readonly type = 'area' as const
  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const out = new BarInterpreter('area' as ChartType).interpret(def, rows)
    return { ...out, type: 'area', horizontal: false }
  }
}

export { BarInterpreter, LineInterpreter, AreaInterpreter }
