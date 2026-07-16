// ── Cartesian builder (bar / hbar / line / waterfall / combo) ──────────

import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@statdash/charts'
import { BASE } from '../base'
import { deriveContext } from './context'
import { buildSeries } from './series'
import { buildColors } from './colors'
import { buildValueAxis, buildCategoryAxis } from './axes'
import { buildBarPlotOptions, buildMarks } from './marks'
import { buildDataLabels } from './data-labels'
import { buildGrid } from './grid'
import { buildLegend, buildTooltip, buildAnnotations } from './chrome'
import { buildResponsive } from './responsive'

/**
 * Assemble ApexOptions for the six cartesian families (bar · hbar · line · area
 * · waterfall · combo). Derives the cross-cutting context once, then composes
 * the pure slice-builders into the options literal — no family conditional lives
 * here; each slice switches on a resolved discriminant off `ctx`.
 *
 * `chartId` — set ONLY when a range-slider brush companion targets this chart
 * (ApexRenderer passes the sanitized main id). It is the sole hook the brush's
 * `brush.target` links to; absent (the default) ⇒ no `chart.id` key is emitted,
 * so the options stay byte-identical to the pre-rangeSlider output (no drift).
 */
export function buildCartesian(output: ChartOutput, fontFamily?: string, locale?: string, chartId?: string): ApexOptions {
  const { stacked } = output
  const ctx = deriveContext(output, locale)

  return {
    ...BASE,
    chart: {
      ...BASE.chart,
      type:       ctx.apexType,
      height:     '100%',
      stacked:    stacked || ctx.forcesStacked,
      fontFamily: fontFamily ?? 'system-ui, sans-serif',
      ...(chartId ? { id: chartId } : {}),
    },
    grid:        buildGrid(output, ctx),
    series:      buildSeries(output, ctx),
    colors:      buildColors(output),
    // Slider-linked mains must join apex's converted-numeric category domain:
    // tickPlacement 'on' lets Config.checkForCatToNumericXAxis convert a BAR's
    // category x-axis to numeric 1..n (line/area already default to 'on'), which
    // is what makes the brush's x-window (xaxis.min/max updates) actually apply —
    // apex cannot window a category axis left at bar's default 'between'.
    // Absent chartId (no slider) ⇒ key not emitted ⇒ options byte-identical.
    xaxis:       { ...buildCategoryAxis(output, ctx), ...(chartId ? { tickPlacement: 'on' as const } : {}) },
    yaxis:       buildValueAxis(output, ctx),
    plotOptions: buildBarPlotOptions(output, ctx),
    dataLabels:  buildDataLabels(output, ctx),
    ...buildMarks(output, ctx),
    legend:      buildLegend(output, ctx, fontFamily),
    tooltip:     buildTooltip(output, ctx),
    annotations: buildAnnotations(ctx),
    responsive:  buildResponsive(output, ctx),
  }
}
