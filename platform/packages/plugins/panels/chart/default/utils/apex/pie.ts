// ── Pie / Donut builder ────────────────────────────────────────────────

import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@statdash/charts'
import { fmtNum }           from '@statdash/engine'
import { BASE, scaledPx, BP_MD, BP_SM, BP_XS } from './base'
import { cssVar } from '@statdash/styles'

const fmtDonutCenter = (n: number) => fmtNum(n, 0)

export function buildPie(output: ChartOutput, fontFamily?: string): ApexOptions {
  const FS_SM = scaledPx(0.72, 11, 13)
  const FS_MD = scaledPx(0.82, 12, 14)
  // Engine produces pie/donut with a single series whose data points = slices.
  const slices   = output.series[0]?.data ?? []
  const values   = slices.map((pt) => pt.value)
  const labels   = output.categories
  // Per-slice colors come from DataRow.color (via interpreter)
  // We store them as thresholdColor (since that's what per-point color maps to)
  // Fall back to a built-in palette if not present.
  const colors   = slices.map((pt) => pt.thresholdColor ?? output.series[0]?.color ?? cssVar('--color-text-muted', '#6B7B8D'))
  const formatted = slices.map((pt) => pt.formatted)

  const hasTotal  = output.type === 'donut' && output.total !== undefined
  const totalText = hasTotal ? fmtDonutCenter(output.total!) : ''

  return {
    ...BASE,
    chart: {
      ...BASE.chart,
      type:       output.type as 'pie' | 'donut',
      height:     '100%',
      fontFamily: fontFamily ?? 'system-ui, sans-serif',
    },
    series: values,
    labels: [...labels],
    colors,
    dataLabels: {
      enabled:   false, // labels hidden; set true to restore (formatter + style kept below)
      formatter: (val: number) => `${fmtNum(val, 1)}%`,
      style: { fontSize: FS_SM, fontWeight: 400 },
      dropShadow: { enabled: false },
    },
    plotOptions: {
      pie: {
        donut: {
          size: output.type === 'donut' ? '62%' : '0%',
          ...(hasTotal ? {
            labels: {
              show:  true,
              total: {
                show:       true,
                showAlways: true,
                label:      output.centerLabel ?? output.axes.y.unit ?? '',
                fontSize:   FS_SM,
                fontWeight: 400,
                color:      cssVar('--color-text-muted', '#6B7B8D'),
                formatter:  () => totalText,
              },
              value: {
                show:       true,
                fontSize:   scaledPx(1.4, 18, 24),
                fontWeight: 700,
                color:      cssVar('--color-text-primary', '#1A2332'),
                offsetY:    4,
                formatter:  () => totalText,
              },
              name: {
                show:    true,
                offsetY: -4,
                color:   cssVar('--color-text-muted', '#6B7B8D'),
              },
            },
          } : {}),
        },
        dataLabels: { offset: -5 },
      },
    },
    legend: {
      show:       true,
      position:   output.legend.position ?? 'bottom',
      fontFamily: fontFamily ?? 'system-ui, sans-serif',
      fontSize:   FS_MD,
      labels:     { colors: cssVar('--color-text-secondary', '#4A5568') },
      markers:    { size: 6 },
      itemMargin: { horizontal: 12 },
      formatter:  (seriesName: string, opts: { w: { globals: { series: number[] } }; seriesIndex: number }) => {
        const pct = opts.w.globals.series.reduce((s: number, v: number) => s + v, 0)
        const val = opts.w.globals.series[opts.seriesIndex] ?? 0
        return pct > 0 ? `${seriesName} · ${fmtNum((val / pct) * 100, 1)}%` : seriesName
      },
    },
    tooltip: {
      ...BASE.tooltip,
      enabled: output.tooltip.show,
      y: { formatter: (_val, opts) => formatted[opts.dataPointIndex] ?? String(_val) },
    },
    // ── Responsive overrides ─────────────────────────────────────────
    //
    //  Donut tightens slightly at smaller widths so the legend gets
    //  the room it needs without overlapping the ring. In-slice labels
    //  are dropped on phone widths to avoid them spilling outside slices.
    //
    responsive: [
      {
        breakpoint: BP_MD,
        options: {
          plotOptions: {
            pie: {
              donut:      { size: output.type === 'donut' ? '60%' : '0%' },
              dataLabels: { offset: -4 },
            },
          },
          dataLabels: { style: { fontSize: '10px' } },
          legend: { fontSize: '10px', itemMargin: { horizontal: 8 } },
        },
      },
      {
        breakpoint: BP_SM,
        options: {
          chart: { height: 280 },
          plotOptions: {
            pie: {
              donut:      { size: output.type === 'donut' ? '56%' : '0%' },
              dataLabels: { offset: -3 },
            },
          },
          dataLabels: { style: { fontSize: '9px' } },
          legend: { fontSize: '10px', itemMargin: { horizontal: 6 } },
        },
      },
      {
        breakpoint: BP_XS,
        options: {
          chart: { height: 240 },
          plotOptions: {
            pie: { donut: { size: output.type === 'donut' ? '52%' : '0%' } },
          },
          dataLabels: { enabled: false },
          legend:     { itemMargin: { horizontal: 4 } },
        },
      },
    ],
  }
}
