// ── Cartesian series assembly ──────────────────────────────────────────
//
//  Maps the neutral ChartOutput series into ApexCharts' extended
//  `{ x, y, fillColor? }` point format, armed by `ctx.seriesMode`:
//    • combo     — per-series `type` + `yAxisIndex` (primary/secondary axis)
//    • waterfall — transparent spacer series float each bar to its base
//    • plain     — name + data
//
//  INVARIANT: maps `output.series` directly, IN ORDER, never re-sorted — the
//  index alignment with buildColors / buildMarks (per-series arrays) depends on
//  it (spec risk #3).
//

import type { ChartOutput } from '@statdash/charts'
import type { CartesianContext } from './context'
import { SPACER, isSpacer } from './families'

export function buildSeries(output: ChartOutput, ctx: CartesianContext): ApexAxisChartSeries {
  const { series, categories } = output
  const { seriesMode, hasY2 } = ctx

  //  Extended data point format: { x, y, fillColor? }. fillColor carries a
  //  per-point override (threshold color / growth sign / spacer) — otherwise
  //  ApexCharts uses the series color from `colors[]`.
  const apexSeries = series.map((s) => {
    const data = s.data.map((pt, di) => ({
      x:         categories[di] ?? di,
      y:         pt.value,
      ...(pt.thresholdColor ? { fillColor: pt.thresholdColor } : {}),
    }))

    switch (seriesMode) {
      case 'combo':
        return {
          name:       s.name,
          type:       s.seriesType ?? 'bar',
          data,
          // ApexCharts yAxisIndex: 0 = primary, 1 = secondary
          ...(hasY2 ? { yAxisIndex: s.yAxis === 'y2' ? 1 : 0 } : {}),
        }
      case 'waterfall':
        return isSpacer(s.name) ? { name: SPACER, data } : { name: s.name, data }
      default:
        return { name: s.name, data }
    }
  })

  return apexSeries
}
