// ── ApexCharts Adapter ─────────────────────────────────────────────────
//
//  ChartOutput (engine neutral format) → ApexCharts ApexOptions.
//  This is THE ONLY PLACE in the codebase that knows about ApexCharts.
//
//  Swap ApexCharts → Recharts:  write rechartsAdapter.ts, delete this file.
//  Add PDF export:              write pdfAdapter.ts using the same ChartOutput.
//  Zero engine changes in all cases.
//
//  Pattern: Grafana panel adapter / Vega-Lite renderer adapter.
//

import type { ApexOptions }  from 'apexcharts'
import type { ChartOutput, ChartSeries } from '@geostat/engine'
import { fmtNum } from '@geostat/engine'

// ── Shared base config ─────────────────────────────────────────────────
//
//  Applied to every chart type. Individual builders override as needed.
//
function liftTooltip(chartCtx: { el: Element }) {
  const tip = chartCtx.el.querySelector<HTMLElement>('.apexcharts-tooltip')
  if (tip) tip.style.zIndex = '99999'
}

const BASE: ApexOptions = {
  chart: {
    toolbar:    { show: false },
    fontFamily: 'BPG Arial, Roboto, sans-serif',
    animations: { enabled: true, easing: 'easeinout', speed: 600,
      animateGradually: { enabled: true, delay: 40 } },
    events: {
      mounted: liftTooltip,
      updated: liftTooltip,
    },
  },
  grid: {
    borderColor:     '#F0F5F3',
    strokeDashArray: 4,
    padding:         { left: 4, right: 4 },
  },
  tooltip: { theme: 'light' },
  states: {
    hover:  { filter: { type: 'lighten', value: 0.08 } },
    active: { filter: { type: 'darken',  value: 0.12 } },
  },
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Build a Y-axis label formatter that appends a unit string. */
function yFormatter(unit?: string, decimals?: number): (val: number) => string {
  return (val: number) => {
    if (val === undefined || val === null) return ''
    const n = typeof decimals === 'number'
      ? fmtNum(val, decimals)
      : Math.abs(val) >= 1000
        ? fmtNum(val / 1000, 0) + ' 000'
        : fmtNum(val, 0)
    return unit ? `${n} ${unit}` : n
  }
}

/**
 * Pre-formatted data labels closure.
 * ApexCharts dataLabels.formatter receives (value, opts).
 * We use opts.seriesIndex + opts.dataPointIndex to look up the
 * engine-formatted string — respects FieldConfig unit/decimals.
 */
function makeDataLabelFormatter(
    formatted: string[][],
): (val: number, opts: { seriesIndex: number; dataPointIndex: number }) => string {
  return (_val, opts) =>
      formatted[opts.seriesIndex]?.[opts.dataPointIndex] ?? ''
}

/** Collect per-series formatted strings from ChartOutput. */
function collectFormatted(series: readonly ChartSeries[]): string[][] {
  return series.map((s) => s.data.map((pt) => pt.formatted))
}

// SVG presentation attributes don't support CSS clamp() — compute from window.innerWidth.
// Called inside each builder at render time, so sizes update on every chart render.
function scaledPx(vw: number, min: number, max: number): string {
  return `${Math.round(Math.min(max, Math.max(min, window.innerWidth * vw / 100)))}px`
}

// ── Responsive breakpoints for numeric (non-CSS) values ────────────────
//
//  ApexCharts numeric values (offsetY, borderRadius, marker.size, padding)
//  cannot use CSS clamp(). The `responsive` array applies overrides when
//  the chart's container width is at-or-below each breakpoint. ApexCharts
//  picks the most-specific match (smallest matching breakpoint wins) and
//  deep-merges the override onto the base options.
//
const BP_MD = 1024 // small laptop / large tablet
const BP_SM = 768  // tablet / large phone landscape
const BP_XS = 480  // phone portrait

// ── Cartesian builder (bar / hbar / line / waterfall / combo) ──────────

function buildCartesian(output: ChartOutput): ApexOptions {
  const { type, series, categories, axes, stacked, horizontal } = output
  const formatted = collectFormatted(series)
  const FS_XS = scaledPx(0.60, 9,  11)
  const FS_SM = scaledPx(0.70, 10, 12)
  const FS_MD = scaledPx(0.80, 11, 12)
  const isWaterfall   = type === 'waterfall'
  const isCombo       = type === 'combo'
  const hasY2         = !!axes.y2
  const isStackedArea = type === 'area' && stacked

  const stackedMax = isStackedArea && categories.length > 0
      ? Math.max(...categories.map((_, i) =>
          series.reduce((sum, s) => sum + (s.data[i]?.value ?? 0), 0)
      ))
      : null
  const yMax = stackedMax ?? undefined

  // ── Series ──────────────────────────────────────────────────────────
  //
  //  Extended data point format: { x, y, fillColor? }
  //  fillColor is used for:
  //    - Threshold colors (engine resolved per-point)
  //    - Waterfall spacer (transparent)
  //    - Growth bars (green/red per sign)
  //
  const apexSeries = series.map((s) => {
    const data = s.data.map((pt, di) => ({
      x:         categories[di] ?? di,
      y:         pt.value,
      // Only set fillColor when there's a specific override — otherwise
      // ApexCharts uses the series color from `colors[]`.
      ...(pt.thresholdColor ? { fillColor: pt.thresholdColor } : {}),
    }))

    if (isCombo) {
      return {
        name:       s.name,
        type:       s.seriesType ?? 'bar',
        data,
        // ApexCharts yAxisIndex: 0 = primary, 1 = secondary
        ...(hasY2 ? { yAxisIndex: s.yAxis === 'y2' ? 1 : 0 } : {}),
      }
    }

    if (isWaterfall && s.name === '__spacer__') {
      return { name: '__spacer__', data }
    }

    return { name: s.name, data }
  })

  // ── Colors ──────────────────────────────────────────────────────────
  //  series.map(s => s.color) gives one color per series.
  //  ApexCharts respects fillColor on individual data points over this.
  const colors = series.map((s) => s.name === '__spacer__' ? 'transparent' : s.color)

  // ── Y-axis ──────────────────────────────────────────────────────────
  //
  //  hbar swaps axes visually:
  //    yaxis (left)   = category axis — strings, no numeric formatter
  //    xaxis (bottom) = value axis    — numeric formatter goes there instead
  //
  //  vbar / line / waterfall / combo:
  //    yaxis (left)   = value axis    — numeric formatter here
  //    xaxis (bottom) = category axis
  //
  const yAxisBase: ApexYAxis = horizontal
      ? {
        labels: { style: { fontSize: FS_SM, colors: '#6B7B8D' }, maxWidth: 220 },
      }
      : {
        labels: {
          style:     { fontSize: FS_SM, colors: '#6B7B8D' },
          formatter: yFormatter(axes.y.unit, axes.y.decimals),
        },
        min:            type === 'area' || type === 'line' ? 0 : axes.y.min,
        max:            isStackedArea ? yMax : axes.y.max,
        forceNiceScale: isStackedArea ? false : (type === 'area' || type === 'line' ? true : undefined),
      }

  const yaxis: ApexYAxis | ApexYAxis[] = hasY2
      ? [
        yAxisBase,
        {
          opposite: true,
          labels: {
            style:     { fontSize: FS_SM, colors: '#6B7B8D' },
            formatter: yFormatter(axes.y2?.unit, axes.y2?.decimals),
          },
          min: axes.y2?.min,
          max: axes.y2?.max,
        },
      ]
      : yAxisBase

  // ── Bar sizing ───────────────────────────────────────────────────────
  //  hbar: ApexCharts uses barHeight (% of row height per category).
  //  Scale with category count so bars stay slim when few items are shown.
  const barCount = horizontal ? (categories.length || 1) : 0
  const barHeight = `${Math.min(72, Math.max(15, barCount * 7))}%`

  // ── Chart type ───────────────────────────────────────────────────────
  //  combo → 'line' as the "host" type (ApexCharts mixes via per-series type)
  //  waterfall → 'bar' + stacked
  //  hbar-diverging → 'bar' + horizontal (no data labels — too crowded)
  const apexType = isCombo
      ? 'line'
      : (type === 'bar' || type === 'hbar' || type === 'hbar-diverging' || type === 'waterfall') ? 'bar' : type as ApexChart['type']

  // ── Data labels ──────────────────────────────────────────────────────
  //  Enabled for bar/hbar/waterfall. Disabled for line/combo and hbar-diverging.
  const showDataLabels = output.dataLabels !== undefined
    ? output.dataLabels
    : (type === 'bar' || type === 'hbar' || type === 'waterfall') && !stacked

  return {
    ...BASE,
    chart: {
      ...BASE.chart,
      type:    apexType,
      height: '100%',
      stacked: stacked || isWaterfall,
    },
    grid: {
      ...BASE.grid,
      // Top padding sized to keep above-bar data labels AND line-chart
      // markers strictly inside the chart bounds. A baseline 6px on all
      // non-stacked types prevents marker/stroke clipping at the top edge.
      padding: {
        left:  4,
        right: horizontal ? 4 : 20,
        top:   isStackedArea ? 40 : (showDataLabels && !horizontal ? 24 : 6),
      },
    },
    series:  apexSeries,
    colors,
    xaxis: {
      // hbar: xaxis is the value axis (bottom) — numeric formatter + no categories.
      // vbar: xaxis is the category axis (bottom) — string categories + no formatter.
      ...(horizontal ? {} : { categories: [...categories] }),
      ...(horizontal ? { min: axes.y.min, max: axes.y.max } : {}),
      labels: horizontal
          ? {
            style:     { fontSize: FS_SM, colors: '#6B7B8D' },
            // xaxis.labels.formatter receives a string — parse back to number first
            formatter: (val: string) => yFormatter(axes.y.unit, axes.y.decimals)(Number(val)),
            hideOverlappingLabels: true,
          }
          : {
            style:        { fontSize: FS_SM, colors: '#6B7B8D' },
            rotate:       -45,
            rotateAlways: false,
            trim:         true,
            // Hard cap on the vertical space reserved for rotated labels —
            // combined with trim:true, overflowing labels get ellipsised
            // rather than pushing the plot area out of the container.
            maxHeight: 100,
            hideOverlappingLabels: true,
          },
      axisBorder: { color: '#E0EBE8' },
      axisTicks:  { color: '#E0EBE8' },
    },
    yaxis,
    plotOptions: {
      bar: {
        horizontal:   horizontal,
        borderRadius: horizontal ? 3 : 4,
        ...(horizontal
            ? { barHeight: barHeight }
            : { columnWidth: stacked ? '45%' : series.length > 1 ? '70%' : '55%' }),
        dataLabels:   { position: 'top' },
      },
    },
    dataLabels: {
      enabled:   showDataLabels,
      formatter: (val: number) => yFormatter(undefined, axes.y.decimals ?? 1)(val),
      offsetY:   horizontal ? 0 : -20,
      offsetX:   horizontal ? 6 : 0,
      style: {
        fontSize:  FS_XS,
        fontWeight: 600,
        colors:    isWaterfall
            // waterfall: only label the visible series
            ? series.map((s) => s.name === '__spacer__' ? 'transparent' : '#2D3748')
            : horizontal ? ['#2D3748'] : ['#6B7B8D'],
      },
      dropShadow: { enabled: false },
    },
    fill: isWaterfall
        ? { opacity: series.map((s) => s.name === '__spacer__' ? 0 : 1) }
        : type === 'area' && stacked
            ? { opacity: 0.88 }
            : type === 'area'
                ? { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.65, opacityTo: 0.1, stops: [0, 90] } }
                : { opacity: 1 },
    stroke: {
      // Line series in combo need a stroke; bar series don't
      width: isCombo
          ? series.map((s) => (s.seriesType ?? 'bar') === 'line' ? 2.5 : 0)
          : isStackedArea ? 2 : (type === 'line' || type === 'area') ? 3 : 0,
      // stacked area: white stroke separates areas and makes the top line visible
      colors: isStackedArea ? series.map(() => '#ffffff') : undefined,
      curve: 'smooth',
    },
    markers: type === 'area' && !stacked || type === 'line' ? {
      size:         5,
      strokeWidth:  2,
      strokeColors: '#fff',
      hover:        { size: 7 },
    } : {},
    legend: {
      show:     output.legend.show,
      position: output.legend.position ?? 'bottom',
      fontFamily: 'BPG Arial, Roboto, sans-serif',
      fontSize:   FS_MD,
      labels:     { colors: '#4A5568' },
      markers:    { size: 6 },
      itemMargin: { horizontal: 12 },
    },
    tooltip: {
      ...BASE.tooltip,
      enabled:   output.tooltip.show,
      // hbar: shared=true groups by x-position (value axis) → all bars show same name.
      // Use shared=false + intersect=true so each bar shows its own category label.
      // waterfall: shared=false too (spacer series would appear in grouped tooltip).
      // output.tooltip.shared overrides the type-default when explicitly set.
      shared:    output.tooltip.shared ?? (!horizontal && !isWaterfall),
      intersect: horizontal,
      y: {
        formatter: (_val, opts) =>
            formatted[opts.seriesIndex]?.[opts.dataPointIndex] ?? String(_val),
      },
    },
    annotations: yMax != null ? {
      yaxis: [{
        y:               yMax,
        strokeDashArray: 4,
        borderColor:     '#94A3B8',
        borderWidth:     1.5,
        label:           { text: '' },
      }],
    } : {},
    // ── Responsive overrides ─────────────────────────────────────────
    //
    //  Pixel-valued options that can't use clamp() shrink in lockstep
    //  with the font clamps as the container narrows. Each breakpoint
    //  tightens the bounding box and reduces inner padding/offsets so
    //  the chart keeps strictly inside its frame at every width.
    //
    responsive: [
      {
        breakpoint: BP_MD,
        options: {
          plotOptions: { bar: { borderRadius: horizontal ? 2 : 3 } },
          markers:     { size: 4, hover: { size: 6 } },
          stroke: {
            width: isCombo
                ? series.map((s) => (s.seriesType ?? 'bar') === 'line' ? 2 : 0)
                : isStackedArea ? 1.5 : (type === 'line' || type === 'area') ? 2.5 : 0,
          },
          ...(showDataLabels && !horizontal ? { dataLabels: { offsetY: -14 } } : {}),
          xaxis:  { labels: { style: { fontSize: '10px' } } },
          yaxis:  { labels: { style: { fontSize: '10px' } } },
          legend: { fontSize: '10px', itemMargin: { horizontal: 8 } },
          grid: {
            padding: {
              left:  4,
              right: horizontal ? 4 : 14,
              top:   isStackedArea ? 30 : (showDataLabels && !horizontal ? 18 : 5),
            },
          },
        },
      },
      {
        breakpoint: BP_SM,
        options: {
          chart:   { height: 280 },
          plotOptions: { bar: { borderRadius: 2 } },
          markers:     { size: 3, hover: { size: 5 } },
          stroke: {
            width: isCombo
                ? series.map((s) => (s.seriesType ?? 'bar') === 'line' ? 2 : 0)
                : isStackedArea ? 1 : (type === 'line' || type === 'area') ? 2 : 0,
          },
          ...(showDataLabels && !horizontal ? { dataLabels: { offsetY: -10 } } : {}),
          xaxis:  horizontal ? {} : { labels: { maxHeight: 70, style: { fontSize: '9px' } } },
          yaxis:  { labels: { style: { fontSize: '9px' } } },
          legend: { fontSize: '10px', itemMargin: { horizontal: 6 } },
          grid: {
            padding: {
              left:  2,
              right: horizontal ? 2 : 10,
              top:   isStackedArea ? 22 : (showDataLabels && !horizontal ? 14 : 4),
            },
          },
        },
      },
      {
        breakpoint: BP_XS,
        options: {
          chart:   { height: 240 },
          plotOptions: { bar: { borderRadius: 2, columnWidth: '85%' } },
          markers:     { size: 0 },
          dataLabels: { enabled: false },
          legend:     { itemMargin: { horizontal: 4 } },
          grid: {
            padding: {
              left:  0,
              right: horizontal ? 0 : 6,
              top:   isStackedArea ? 16 : 4,
            },
          },
          xaxis: horizontal
              ? {}
              : { labels: { rotate: -90, maxHeight: 60 } },
        },
      },
    ],
  }
}

// ── Pie / Donut builder ────────────────────────────────────────────────

const fmtDonutCenter = (n: number) => fmtNum(n, 0)

function buildPie(output: ChartOutput): ApexOptions {
  const FS_SM = scaledPx(0.70, 10, 12)
  const FS_MD = scaledPx(0.80, 11, 12)
  // Engine produces pie/donut with a single series whose data points = slices.
  const slices   = output.series[0]?.data ?? []
  const values   = slices.map((pt) => pt.value)
  const labels   = output.categories
  // Per-slice colors come from DataRow.color (via interpreter)
  // We store them as thresholdColor (since that's what per-point color maps to)
  // Fall back to a built-in palette if not present.
  const colors   = slices.map((pt) => pt.thresholdColor ?? output.series[0]?.color ?? '#6B7B8D')
  const formatted = slices.map((pt) => pt.formatted)

  const hasTotal  = output.type === 'donut' && output.total !== undefined
  const totalText = hasTotal ? fmtDonutCenter(output.total!) : ''

  return {
    ...BASE,
    chart: {
      ...BASE.chart,
      type:   output.type as 'pie' | 'donut',
      height: '100%',
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
                color:      '#6B7B8D',
                formatter:  () => totalText,
              },
              value: {
                show:       true,
                fontSize:   scaledPx(1.4, 18, 24),
                fontWeight: 700,
                color:      '#1A2332',
                offsetY:    4,
                formatter:  () => totalText,
              },
              name: {
                show:    true,
                offsetY: -4,
                color:   '#6B7B8D',
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
      fontFamily: 'BPG Arial, Roboto, sans-serif',
      fontSize:   FS_MD,
      labels:     { colors: '#4A5568' },
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

// ── Contribution builder ───────────────────────────────────────────────
//
//  Expenditure-equation chart: all bars start at zero, absolute height.
//  Per-bar color is carried as thresholdColor (interpreter resolved it).
//  No stacking, no separate categories array — x values come from the
//  extended data point `{ x, y, fillColor }` format.
//

// Split a label string into lines so no line exceeds maxChars characters.
// ApexCharts xaxis.categories accepts string[][] for multi-line labels.
function wrapLabel(text: string, maxChars = 18): string[] {
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

function buildContribution(output: ChartOutput): ApexOptions {
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

// ── Treemap builder ────────────────────────────────────────────────────

function buildTreemap(output: ChartOutput): ApexOptions {
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
      style: { fontSize: FS_LG, fontWeight: '500', colors: ['#ffffff'] },
    },
    stroke: { width: 2, colors: ['#ffffff'] },
    plotOptions: {
      treemap: { distributed: true, enableShades: false, useFillColorAsStroke: false },
    },
    colors: [series[0]?.color ?? '#0080BE'],
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

// ── HBarDiverging builder ──────────────────────────────────────────────
//
//  Horizontal bar chart with n-level grouped category axis.
//  Uses ApexCharts native xaxis.group: flat categories + group spans.
//  Both series (Resources / Uses) positive — series name + color encode side.
//

function buildHBarDiverging(output: ChartOutput): ApexOptions {
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

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Convert engine ChartOutput → ApexCharts ApexOptions.
 *
 * The ONLY translation point between engine and ApexCharts.
 * Input is 100% renderer-agnostic. Output is ApexCharts-specific.
 */
export function toApexOptions(output: ChartOutput): ApexOptions {
  switch (output.type) {
    case 'pie':
    case 'donut':
      return buildPie(output)

    case 'bar':
    case 'hbar':
    case 'line':
    case 'area':
    case 'waterfall':
    case 'combo':
      return buildCartesian(output)

    case 'contribution':
      return buildContribution(output)

    case 'hbar-diverging':
      return buildHBarDiverging(output)

    case 'treemap':
      return buildTreemap(output)

      // Placeholder + unknown types — engine returns empty ChartOutput, adapter returns minimal config.
      // ChartType is an open string (registry is the source of truth), so a default is required:
      // an unrendered/unregistered type degrades to the minimal base rather than crashing.
    case 'map':
    case 'sankey':
    default:
      return { ...BASE, chart: { ...BASE.chart, height: '100%' } }
  }
}