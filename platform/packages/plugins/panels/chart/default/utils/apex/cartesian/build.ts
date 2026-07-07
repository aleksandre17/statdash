// ── Cartesian builder (bar / hbar / line / waterfall / combo) ──────────

import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@statdash/charts'
import { BASE, responsiveYAxis, BP_MD, BP_SM, BP_XS } from '../base'
import { cssVar } from '@statdash/styles'
import { deriveContext } from './context'
import { buildSeries } from './series'
import { buildColors } from './colors'
import { buildValueAxis, buildCategoryAxis } from './axes'
import { buildBarPlotOptions, buildMarks, strokeWidth } from './marks'
import { buildDataLabels } from './data-labels'

export function buildCartesian(output: ChartOutput, fontFamily?: string, locale?: string): ApexOptions {
  const { stacked, horizontal } = output
  const ctx = deriveContext(output, locale)
  const {
    formatted, FS_MD,
    isWaterfall, hasY2, isStackedArea,
    apexXHidden, apexYHidden,
    yFmt, y2Fmt, yMax, apexType, showDataLabels,
    forcesStacked,
  } = ctx

  // Responsive numeric-y-axis font override that keeps the formatter alive.
  // hbar's left axis is categorical (no numeric formatter), so it keeps the
  // bare style override; vbar/combo carry the value formatter (and y2's).
  const yaxisFont = (fontSize: string): ApexYAxis | ApexYAxis[] =>
      // ApexCharts' responsive merge REBUILDS yaxis from defaults (extendYAxis),
      // which would re-show a hidden axis — re-assert the hide at every breakpoint.
      apexYHidden
          ? { show: false }
          : horizontal
          ? { labels: { style: { fontSize }, maxWidth: 220 } }
          : hasY2
              ? [responsiveYAxis(fontSize, yFmt), responsiveYAxis(fontSize, y2Fmt)]
              : responsiveYAxis(fontSize, yFmt)

  const apexSeries = buildSeries(output, ctx)
  const colors     = buildColors(output)
  const yaxis      = buildValueAxis(output, ctx)

  return {
    ...BASE,
    chart: {
      ...BASE.chart,
      type:       apexType,
      height:     '100%',
      stacked:    stacked || forcesStacked,
      fontFamily: fontFamily ?? 'system-ui, sans-serif',
    },
    grid: {
      ...BASE.grid,
      // A hidden axis takes its gridlines with it (only that axis's lines are
      // overridden — the visible axis keeps its ApexCharts default so a vertical
      // chart's horizontal grid, or an hbar's vertical grid, is untouched).
      ...(apexXHidden ? { xaxis: { lines: { show: false } } } : {}),
      ...(apexYHidden ? { yaxis: { lines: { show: false } } } : {}),
      // Top padding keeps above-bar data labels + line markers inside the chart
      // bounds (baseline 6px). Horizontal bars place their value label OUTSIDE the
      // bar end (position:'top' + offsetX) — right whitespace + the hbarValueMax
      // scale headroom keep the longest end-label inside the SVG (F10/F13 clip).
      padding: {
        left:  4,
        right: horizontal ? (showDataLabels ? 44 : 8) : 20,
        top:   isStackedArea ? 40 : (showDataLabels && !horizontal ? 24 : 6),
      },
    },
    series:  apexSeries,
    colors,
    xaxis: buildCategoryAxis(output, ctx),
    yaxis,
    plotOptions: buildBarPlotOptions(output, ctx),
    dataLabels:  buildDataLabels(output, ctx),
    ...buildMarks(output, ctx),
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
          stroke:      { width: strokeWidth(output, ctx, 'md') },
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
          stroke:      { width: strokeWidth(output, ctx, 'sm') },
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
