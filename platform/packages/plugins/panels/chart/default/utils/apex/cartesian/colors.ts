// ── Cartesian series colors ────────────────────────────────────────────
//
//  One color per series. ApexCharts respects a per-point `fillColor` over
//  these, so semantic per-point colours are always preserved.
//
//    • distributed        (single-series categorical) — cycle the categorical
//      palette SSOT (chartPalette) so each CATEGORY reads by its own hue.
//    • seriesColorByIndex (multi-series, no explicit colour) — each SERIES takes
//      chartColorAt(i) from the SAME SSOT, resolved theme-aware here (the neutral
//      format cannot hold a var() — Law 1/4). Set only when NO series carried a
//      semantic colour, so painting by index never clobbers a meaningful hue.
//    • explicit           — each series' own `s.color`.
//
//  Spacer series (waterfall) paint transparent in both per-series branches.
//
//  INVARIANT: maps `output.series` IN ORDER, never re-sorted — index alignment
//  with buildSeries / buildMarks depends on it (spec risk #3).
//

import type { ChartOutput } from '@statdash/charts'
import { chartPalette, chartColorAt } from '@statdash/styles'
import { isSpacer } from './families'

export function buildColors(output: ChartOutput): string[] {
  const { series } = output
  const distributed      = output.distributed === true
  const colorBySeriesIdx = output.seriesColorByIndex === true
  return distributed
      ? chartPalette()
      : colorBySeriesIdx
          ? series.map((s, i) => isSpacer(s.name) ? 'transparent' : chartColorAt(i))
          : series.map((s) => isSpacer(s.name) ? 'transparent' : s.color)
}
