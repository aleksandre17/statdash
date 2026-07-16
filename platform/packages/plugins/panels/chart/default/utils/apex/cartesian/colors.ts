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
import { chartPalette, chartColorAt, chartSequential, chartSequentialSample } from '@statdash/styles'
import { isSpacer } from './families'

export function buildColors(output: ChartOutput): string[] {
  const { series } = output
  const distributed      = output.distributed === true
  const colorBySeriesIdx = output.seriesColorByIndex === true
  const sequential       = output.palette === 'sequential'

  // ── Sequential single-hue ramp (palette: "sequential") ──────────────────
  //  Encodes ONE quantity, so the colour reading stays monochrome blue:
  //    • distributed single series → each CATEGORY along the ramp (gradient by class)
  //    • by-index multi-series      → each SERIES along the ramp
  //    • plain single series        → the ramp ANCHOR (accent blue), a HONEST uniform
  //      hue (a bare time-series bar's per-bar colour would encode nothing — ONS
  //      clarity), painted from the palette token, never a per-chart hardcoded hex.
  //  INVARIANT preserved: series order is never re-sorted; spacer stays transparent.
  if (sequential) {
    if (distributed)      return chartSequentialSample(seriesPointCount(output))
    if (colorBySeriesIdx) return series.map((s, i) => isSpacer(s.name) ? 'transparent' : chartSequentialSample(series.length)[i]!)
    const anchor = chartSequential()[SEQ_ANCHOR]!
    return series.map((s) => isSpacer(s.name) ? 'transparent' : anchor)
  }

  return distributed
      ? chartPalette()
      : colorBySeriesIdx
          ? series.map((s, i) => isSpacer(s.name) ? 'transparent' : chartColorAt(i))
          : series.map((s) => isSpacer(s.name) ? 'transparent' : s.color)
}

// Ramp index used as the uniform anchor for a plain single-series sequential
// chart — the accent-blue class (--chart-seq-5 / #0080be, the portal accent).
const SEQ_ANCHOR = 4

/** Category count a distributed single-series chart paints across (its data points). */
function seriesPointCount(output: ChartOutput): number {
  return output.categories.length || output.series[0]?.data.length || 1
}
