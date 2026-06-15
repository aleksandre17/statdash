// ── Contribution builder ───────────────────────────────────────────────
//
//  Expenditure-equation chart: all bars start at zero, absolute height.
//  Per-bar color is carried as thresholdColor (interpreter resolved it).
//  No stacking, no separate categories array — x values come from the
//  extended data point `{ x, y, fillColor }` format.
//

import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@geostat/charts'
import { BASE, yFormatter, collectFormatted, scaledPx, BP_MD, BP_SM, BP_XS } from './base'

// Split a label string into lines so no line exceeds maxChars characters.
// ApexCharts xaxis.categories accepts string[][] for multi-line labels.
export function wrapLabel(text: string, maxChars = 18): string[] {
  const words = text.split(' ')
  if (words.length <= 1) return [text]
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) { current = next }
    else { if (current) lines.push(current); current = word }
  }
  if (current) lines.push(current)
  return lines.length > 1 ? lines : [text]
}

export function buildContribution(output: ChartOutput): ApexOptions {
  const { series, categories, axes } = output
  const formatted = collectFormatted(series)
  const FS_XS = scaledPx(0.60, 9,  11)
  const FS_SM = scaledPx(0.70, 10, 12)

  // Per-bar colors via distributed — avoids {x,y,fillColor} extended format which
  // conflicts with xaxis.categories and breaks y-axis rendering.
  const barColors  = series.flatMap((s) =>
      s.data.map((pt) => pt.thresholdColor ?? s.color ?? '#0080BE'),
  )
  const apexSeries = series.map((s) => ({
    name: s.name,
    data: s.data.map((pt) => pt.value),
  }))

  return {
    ...BASE,
    chart: { ...BASE.chart, type: 'bar', height: '100%' },
    grid:  { ...BASE.grid, padding: { left: 0, right: 0, top: 0 } },
    series:  apexSeries,
    colors:  barColors,
    xaxis: {
      // string[][] → each sub-array renders as stacked tspan lines (ApexCharts documented).
      categories: categories.map((c) => wrapLabel(c)) as unknown as string[],
      labels: {
        style:                 { fontSize: FS_XS, colors: '#6B7B8D' },
        rotate:                0,
        maxHeight:             80,
        hideOverlappingLabels: false,
      },
      axisBorder: { color: '#E0EBE8' },
      axisTicks:  { color: '#E0EBE8' },
    },
    yaxis: {
      labels: {
        style:     { fontSize: FS_SM, colors: '#6B7B8D' },
        formatter: yFormatter(axes.y.unit, axes.y.decimals),
      },
    },
    plotOptions: {
      bar: {
        horizontal:   false,
        borderRadius: 4,
        columnWidth:  '48%',
        distributed:  true,
        dataLabels:   { position: 'top' },
      },
    },
    dataLabels: {
      enabled:   true,
      formatter: (val: number) => yFormatter(undefined, axes.y.decimals ?? 1)(val),
      offsetY:   -20,
      style: {
        fontSize:   FS_XS,
        fontWeight: 400,
        colors:     ['#6B7B8D'],
      },
    },
    legend: { show: false },
    tooltip: {
      ...BASE.tooltip,
      enabled:   output.tooltip.show,
      shared:    false,
      intersect: true,
      y: {
        // distributed:true re-indexes seriesIndex per bar; use dataPointIndex on series[0]
        formatter: (_val, opts) =>
            formatted[0]?.[opts.dataPointIndex] ?? String(_val),
      },
    },
    responsive: [
      {
        breakpoint: BP_MD,
        options: {
          plotOptions: { bar: { borderRadius: 3 } },
          xaxis:       { labels: { style: { fontSize: '10px' } } },
          yaxis:       { labels: { style: { fontSize: '10px' } } },
          dataLabels:  { offsetY: -14, style: { fontSize: '9px' } },
          grid:        { padding: { left: 4, right: 14, top: 18 } },
        },
      },
      {
        breakpoint: BP_SM,
        options: {
          chart:       { height: 280 },
          plotOptions: { bar: { borderRadius: 2, columnWidth: '75%' } },
          xaxis:       { labels: { style: { fontSize: '9px' } } },
          yaxis:       { labels: { style: { fontSize: '9px' } } },
          dataLabels:  { offsetY: -10, style: { fontSize: '9px' } },
          grid:        { padding: { left: 2, right: 10, top: 14 } },
        },
      },
      {
        breakpoint: BP_XS,
        options: {
          chart:       { height: 240 },
          plotOptions: { bar: { columnWidth: '85%' } },
          dataLabels:  { enabled: false },
          grid:        { padding: { left: 0, right: 6, top: 6 } },
          xaxis:       { labels: { style: { fontSize: '9px' }, maxHeight: 52 } },
        },
      },
    ],
  }
}
