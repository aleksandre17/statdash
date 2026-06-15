// ── HBarDiverging builder ──────────────────────────────────────────────
//
//  Horizontal bar chart with n-level grouped category axis.
//  Uses ApexCharts native xaxis.group: flat categories + group spans.
//  Both series (Resources / Uses) positive — series name + color encode side.
//

import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@geostat/engine'
import { BASE, yFormatter, makeDataLabelFormatter, collectFormatted, scaledPx, BP_MD, BP_SM, BP_XS } from './base'

export function buildHBarDiverging(output: ChartOutput): ApexOptions {
  const { series, axes } = output
  const FS_XS = scaledPx(0.60, 9,  11)
  const FS_SM = scaledPx(0.70, 10, 12)
  const FS_MD = scaledPx(0.80, 11, 12)
  const groups    = output.groups ?? []
  const categories = [...output.categories]
  const formatted = collectFormatted(series)
  const colors    = series.map((s) => s.color)

  // Plain value arrays — xaxis.categories are the leaf item labels
  const apexSeries = series.map((s) => ({
    name: s.name,
    data: s.data.map((pt) => pt.value || null),
  }))

  return {
    ...BASE,
    chart: {
      ...BASE.chart,
      type:   'bar',
      height: '100%',
    },
    series:  apexSeries,
    colors,
    xaxis: {
      // xaxis.group: native ApexCharts n-level grouped category axis.
      // groups[] drives the secondary (outer) label row, spanning cols items each.
      categories,
      ...(groups.length > 0 ? {
        group: {
          groups: groups.map((g) => ({ title: g.label, cols: g.length })),
          style:  { fontSize: FS_SM, fontWeight: 700, colors: '#4A5568' },
        },
      } : {}),
      min:        axes.y.min,
      max:        axes.y.max,
      labels: {
        style:     { fontSize: FS_XS, colors: '#6B7B8D' },
        formatter: (val: string) => yFormatter(axes.y.unit, axes.y.decimals)(Number(val)),
        hideOverlappingLabels: true,
      },
      axisBorder: { color: '#E0EBE8' },
      axisTicks:  { color: '#E0EBE8' },
    },
    yaxis: {
      labels: { style: { fontSize: FS_SM, colors: '#6B7B8D' } },
    },
    plotOptions: {
      bar: {
        horizontal:   true,
        borderRadius: 3,
        columnWidth:  series.length > 1 ? '70%' : '55%',
        dataLabels:   { position: 'center' },
      },
    },
    dataLabels: {
      enabled:   false,
      formatter: makeDataLabelFormatter(formatted),
      style:     { fontSize: FS_XS, fontWeight: 400, colors: ['#6B7B8D'] },
    },
    legend: {
      show:       output.legend.show,
      position:   output.legend.position ?? 'bottom',
      fontFamily: 'BPG Arial, Roboto, sans-serif',
      fontSize:   FS_MD,
      labels:     { colors: '#4A5568' },
      markers:    { size: 6 },
      itemMargin: { horizontal: 12 },
    },
    tooltip: {
      ...BASE.tooltip,
      enabled:   output.tooltip.show,
      shared:    false,
      intersect: true,
      y: {
        formatter: (_val, opts) =>
            formatted[opts.seriesIndex]?.[opts.dataPointIndex] ?? String(_val),
      },
    },
    responsive: [
      {
        breakpoint: BP_MD,
        options: {
          plotOptions: { bar: { borderRadius: 2 } },
          legend:      { itemMargin: { horizontal: 8 } },
        },
      },
      {
        breakpoint: BP_SM,
        options: {
          chart:       { height: 320 },
          plotOptions: { bar: { borderRadius: 2 } },
          legend:      { itemMargin: { horizontal: 6 } },
        },
      },
      {
        breakpoint: BP_XS,
        options: {
          chart:       { height: 260 },
          plotOptions: { bar: { borderRadius: 2, columnWidth: '85%' } },
          legend:      { itemMargin: { horizontal: 4 } },
        },
      },
    ],
  }
}
