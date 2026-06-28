// ── Treemap builder ────────────────────────────────────────────────────

import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@statdash/charts'
import { BASE, scaledPx, BP_MD, BP_SM, BP_XS } from './base'
import { cssVar, chartPalette } from '@statdash/styles'

export function buildTreemap(output: ChartOutput): ApexOptions {
  const { series, categories } = output
  const pts       = series[0]?.data ?? []
  const formatted = pts.map((pt) => pt.formatted)
  const FS_LG = scaledPx(0.85, 12, 14)

  return {
    ...BASE,
    chart: { ...BASE.chart, type: 'treemap', height: '100%' },
    // Treemap has no axes — zero out grid padding so tiles fill the full container.
    grid: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    series: [{
      data: pts.map((pt, i) => ({
        x: categories[i] ?? String(i),
        y: pt.value,
        ...(pt.thresholdColor ? { fillColor: pt.thresholdColor } : {}),
      })),
    }],
    dataLabels: {
      enabled: true,
      formatter: (text: string) => text,
      style: { fontSize: FS_LG, fontWeight: '500', colors: [cssVar('--color-text-inverse', '#ffffff')] },
    },
    stroke: { width: 2, colors: [cssVar('--color-text-inverse', '#ffffff')] },
    plotOptions: {
      // distributed: each tile draws the next colour from `colors` (cycled). The
      // categorical palette below makes a single-series treemap read by category;
      // per-point `fillColor` (set from thresholdColor above) still wins when the
      // data carries a semantic colour, so meaning is preserved.
      treemap: { distributed: true, enableShades: false, useFillColorAsStroke: false },
    },
    colors: chartPalette(),
    tooltip: {
      ...BASE.tooltip,
      enabled: output.tooltip.show,
      y: {
        formatter: (_val: number, opts: { dataPointIndex: number }) =>
            formatted[opts.dataPointIndex] ?? String(_val),
      },
    },
    // Treemap tiles are CSS-sized so layout adapts naturally; only the
    // overlaid text and dividing strokes need to step down at small sizes.
    responsive: [
      {
        breakpoint: BP_MD,
        options: {
          dataLabels: { style: { fontSize: '11px' } },
          stroke:     { width: 1.5 },
        },
      },
      {
        breakpoint: BP_SM,
        options: {
          dataLabels: { style: { fontSize: '10px' } },
          stroke:     { width: 1 },
        },
      },
      {
        breakpoint: BP_XS,
        options: {
          dataLabels: { style: { fontSize: '9px' } },
          stroke:     { width: 1 },
        },
      },
    ],
  }
}
