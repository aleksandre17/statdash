// ── Radial Chart Interpreters ─────────────────────────────────────────

import type { DataRow, ChartType } from '@statdash/engine'
import { resolveFieldConfig } from '@statdash/engine'
import type { ChartDef, ChartOutput, ChartSeries } from '../types'
import type { ChartInterpreter } from '../registry'
import { buildDataPoint, buildLegend, buildTooltip } from './shared'
import { placeholderOutput } from '../interpret'
import { DEFAULT_SERIES_COLOR } from '../colors'

// ── PieInterpreter (handles 'pie' and 'donut') ────────────────────────

class PieInterpreter implements ChartInterpreter {
  readonly type: ChartType
  constructor(type: ChartType = 'pie') { this.type = type }

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const fc        = def.fieldConfig
    const totalRow  = rows.find((r) => r.isTotal)
    const sliceRows = rows.filter((r) => !r.isTotal && r.value !== 0)
    if (sliceRows.length === 0) return placeholderOutput(def)
    const series: ChartSeries[] = [{
      name:  def.label,
      data:  sliceRows.map((r) => buildDataPoint(r, resolveFieldConfig(fc, r.label))),
      color: DEFAULT_SERIES_COLOR,
    }]
    return {
      type: this.type, height: def.height,
      categories: sliceRows.map((r) => r.label), series,
      axes: { x: {}, y: {} }, stacked: false, horizontal: false,
      legend: buildLegend(def, sliceRows.length),
      tooltip: buildTooltip(def, false),
      annotations: [],
      // Data-label visibility passes through so the renderer can honor it (donut/pie
      // default OFF per the ChartOutput contract — numeric slice values are hover-only,
      // category names stay in the legend). `dataLabels: true` opts a slice-value donut
      // back in. Declarative + Constructor-controllable; no per-chart hardcode.
      ...(def.dataLabels !== undefined ? { dataLabels: def.dataLabels } : {}),
      ...(totalRow !== undefined ? { total: totalRow.value } : {}),
      ...(def.centerLabel ? { centerLabel: def.centerLabel } : {}),
      ...(def.palette ? { palette: def.palette } : {}),
    }
  }
}

export { PieInterpreter }
