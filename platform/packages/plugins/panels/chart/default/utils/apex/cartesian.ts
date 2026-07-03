// ── Cartesian builder (bar / hbar / line / waterfall / combo) ──────────

import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@statdash/charts'
import { BASE, yFormatter, responsiveYAxis, collectFormatted, scaledPx, verticalBarFillPct, horizontalBarFillPct, BP_MD, BP_SM, BP_XS } from './base'
import { cssVar, chartPalette, chartColorAt } from '@statdash/styles'

export function buildCartesian(output: ChartOutput, fontFamily?: string, locale?: string): ApexOptions {
  const { type, series, categories, axes, stacked, horizontal } = output
  const formatted = collectFormatted(series)
  const FS_XS = scaledPx(0.60, 9,  11)
  const FS_SM = scaledPx(0.70, 10, 12)
  const FS_MD = scaledPx(0.80, 11, 12)
  const isWaterfall   = type === 'waterfall'
  const isCombo       = type === 'combo'
  const hasY2         = !!axes.y2
  const isStackedArea = type === 'area' && stacked

  // Value-axis formatters — hoisted so the responsive overrides below can
  // re-carry them (ApexCharts rebuilds yaxis from defaults on responsive
  // merge, dropping any formatter not re-supplied — see responsiveYAxis).
  const yFmt  = yFormatter(axes.y.unit,  axes.y.decimals,  locale)
  const y2Fmt = yFormatter(axes.y2?.unit, axes.y2?.decimals, locale)

  // Responsive numeric-y-axis font override that keeps the formatter alive.
  // hbar's left axis is categorical (no numeric formatter), so it keeps the
  // bare style override; vbar/combo carry the value formatter (and y2's).
  const yaxisFont = (fontSize: string): ApexYAxis | ApexYAxis[] =>
      horizontal
          ? { labels: { style: { fontSize }, maxWidth: 220 } }
          : hasY2
              ? [responsiveYAxis(fontSize, yFmt), responsiveYAxis(fontSize, y2Fmt)]
              : responsiveYAxis(fontSize, yFmt)

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
  //
  //  distributed (single-series categorical) mirrors the treemap seam: bars
  //  cycle the categorical palette SSOT (chartPalette) so each category reads
  //  by its own hue; per-point `fillColor` (from a semantic DataRow.color) still
  //  wins where present, so meaning is preserved.
  //
  //  seriesColorByIndex (multi-series, no explicit colour) is the color-BY-SERIES
  //  analogue: each series takes chartColorAt(i) from the SAME SSOT, resolved
  //  theme-aware here (the neutral format cannot hold a var() — Law 1/4). The
  //  interpreter set the flag only when NO series carried semantic colour, so
  //  painting every series by index here never clobbers a meaningful hue.
  const distributed      = output.distributed === true
  const colorBySeriesIdx = output.seriesColorByIndex === true
  const colors = distributed
      ? chartPalette()
      : colorBySeriesIdx
          ? series.map((s, i) => s.name === '__spacer__' ? 'transparent' : chartColorAt(i))
          : series.map((s) => s.name === '__spacer__' ? 'transparent' : s.color)

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
        labels: { style: { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') }, maxWidth: 220 },
      }
      : {
        labels: {
          style:     { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') },
          formatter: yFmt,
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
            style:     { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') },
            formatter: y2Fmt,
          },
          min: axes.y2?.min,
          max: axes.y2?.max,
        },
      ]
      : yAxisBase

  // ── Bar sizing ───────────────────────────────────────────────────────
  //  ApexCharts sizes a bar as a % of its per-category slot (barHeight for
  //  horizontal, columnWidth for vertical). The fill % is derived from an
  //  ABSOLUTE thickness cap (see base.ts): a solo/2-bar chart reads as a focus
  //  bar of sane thickness with whitespace, never a fat stripe; many bars still
  //  fill their slots up to a gap-preserving ceiling. Horizontal caps against the
  //  exact owned height; vertical against the estimated plot width (Law 1/4).
  const barFill = `${horizontal ? horizontalBarFillPct(output) : verticalBarFillPct(categories.length)}%`

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
      type:       apexType,
      height:     '100%',
      stacked:    stacked || isWaterfall,
      fontFamily: fontFamily ?? 'system-ui, sans-serif',
    },
    grid: {
      ...BASE.grid,
      // Top padding sized to keep above-bar data labels AND line-chart
      // markers strictly inside the chart bounds. A baseline 6px on all
      // non-stacked types prevents marker/stroke clipping at the top edge.
      //
      // Horizontal bars place their value dataLabel OUTSIDE the bar end
      // (position:'top' + offsetX). Reserving right whitespace keeps the
      // longest bar's end-label ("42 620.8" — the F10/F13 regional clip)
      // inside the SVG instead of shearing at the plot edge. Vertical bars
      // keep their smaller right pad (labels sit above bars, not at the edge).
      padding: {
        left:  4,
        right: horizontal ? (showDataLabels ? 44 : 8) : 20,
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
            style:     { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') },
            // xaxis.labels.formatter receives a string — parse back to number first
            formatter: (val: string) => yFmt(Number(val)),
            hideOverlappingLabels: true,
          }
          : {
            style:        { fontSize: FS_SM, colors: cssVar('--color-text-muted', '#6B7B8D') },
            rotate:       -45,
            rotateAlways: false,
            trim:         true,
            // Hard cap on the vertical space reserved for rotated labels —
            // combined with trim:true, overflowing labels get ellipsised
            // rather than pushing the plot area out of the container.
            maxHeight: 100,
            hideOverlappingLabels: true,
          },
      axisBorder: { color: cssVar('--color-chart-frame', '#E0EBE8') },
      axisTicks:  { color: cssVar('--color-chart-frame', '#E0EBE8') },
    },
    yaxis,
    plotOptions: {
      bar: {
        distributed:  distributed,
        horizontal:   horizontal,
        borderRadius: horizontal ? 3 : 4,
        ...(horizontal
            ? { barHeight: barFill }
            : { columnWidth: barFill }),
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
            ? series.map((s) => s.name === '__spacer__' ? 'transparent' : cssVar('--color-text-secondary', '#2D3748'))
            : horizontal ? [cssVar('--color-text-secondary', '#2D3748')] : [cssVar('--color-text-muted', '#6B7B8D')],
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
      colors: isStackedArea ? series.map(() => cssVar('--color-surface', '#ffffff')) : undefined,
      curve: 'smooth',
    },
    markers: type === 'area' && !stacked || type === 'line' ? {
      size:         5,
      strokeWidth:  2,
      strokeColors: cssVar('--color-surface', '#fff'),
      hover:        { size: 7 },
    } : {},
    legend: {
      show:     output.legend.show,
      position: output.legend.position ?? 'bottom',
      fontFamily: fontFamily ?? 'system-ui, sans-serif',
      fontSize:   FS_MD,
      labels:     { colors: cssVar('--color-text-secondary', '#4A5568') },
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
        borderColor:     cssVar('--color-text-faint', '#94A3B8'),
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
          yaxis:  yaxisFont('10px'),
          legend: { fontSize: '10px', itemMargin: { horizontal: 8 } },
          grid: {
            padding: {
              left:  4,
              right: horizontal ? (showDataLabels ? 40 : 4) : 14,
              top:   isStackedArea ? 30 : (showDataLabels && !horizontal ? 18 : 5),
            },
          },
        },
      },
      {
        breakpoint: BP_SM,
        options: {
          // Horizontal charts keep their category-derived height (set on the
          // ReactApexChart `height` prop) — a fixed short height here would
          // re-cram the rows at narrow widths. Vertical charts shrink as before.
          ...(horizontal ? {} : { chart: { height: 280 } }),
          plotOptions: { bar: { borderRadius: 2 } },
          markers:     { size: 3, hover: { size: 5 } },
          stroke: {
            width: isCombo
                ? series.map((s) => (s.seriesType ?? 'bar') === 'line' ? 2 : 0)
                : isStackedArea ? 1 : (type === 'line' || type === 'area') ? 2 : 0,
          },
          ...(showDataLabels && !horizontal ? { dataLabels: { offsetY: -10 } } : {}),
          xaxis:  horizontal ? {} : { labels: { maxHeight: 70, style: { fontSize: '9px' } } },
          yaxis:  yaxisFont('9px'),
          legend: { fontSize: '10px', itemMargin: { horizontal: 6 } },
          grid: {
            padding: {
              left:  2,
              right: horizontal ? (showDataLabels ? 34 : 2) : 10,
              top:   isStackedArea ? 22 : (showDataLabels && !horizontal ? 14 : 4),
            },
          },
        },
      },
      {
        breakpoint: BP_XS,
        options: {
          ...(horizontal ? {} : { chart: { height: 240 } }),
          // Keep the low-cardinality thickness cap on mobile — inherit the base
          // columnWidth (a flat '85%' here would re-fatten a solo bar to a stripe).
          plotOptions: { bar: { borderRadius: 2 } },
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
