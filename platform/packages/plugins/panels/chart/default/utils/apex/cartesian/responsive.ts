// ── Cartesian responsive overrides ─────────────────────────────────────
//
//  Pixel-valued options that can't use CSS clamp() shrink in lockstep with the
//  font clamps as the container narrows. Each breakpoint tightens the bounding
//  box + inner padding/offsets so the chart stays strictly inside its frame.
//
//  Reuses the SSOTs so nothing drifts from the base build: stroke widths via
//  marks.strokeWidth, padding via grid.gridPadding. The yaxisFont closure
//  re-carries the value formatter at every breakpoint — ApexCharts' responsive
//  merge rebuilds yaxis from defaults (extendYAxis), silently dropping any
//  formatter/hide not re-supplied (spec risk #2).
//

import type { ChartOutput } from '@statdash/charts'
import type { CartesianContext } from './context'
import { responsiveYAxis, BP_MD, BP_SM, BP_XS } from '../base'
import { strokeWidth } from './marks'
import { gridPadding } from './grid'

export function buildResponsive(output: ChartOutput, ctx: CartesianContext): ApexResponsive[] {
  const { horizontal } = output
  const { apexYHidden, hasY2, yFmt, y2Fmt, showDataLabels } = ctx

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

  return [
    {
      breakpoint: BP_MD,
      options: {
        plotOptions: { bar: { borderRadius: horizontal ? 2 : 3 } },
        markers:     { size: 4, hover: { size: 6 } },
        stroke:      { width: strokeWidth(output, ctx, 'md') },
        ...(showDataLabels && !horizontal ? { dataLabels: { offsetY: -14 } } : {}),
        xaxis:  { labels: { style: { fontSize: '10px' } } },
        yaxis:  yaxisFont('10px'),
        // legend fontSize never overridden per breakpoint — --chart-legend-font-size
        // is the ONE size for every chart's legend (owner verdict R2-3).
        legend: { itemMargin: { horizontal: 8 } },
        grid:   { padding: gridPadding(output, ctx, 'md') },
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
        legend: { itemMargin: { horizontal: 6 } },
        grid:   { padding: gridPadding(output, ctx, 'sm') },
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
        grid:       { padding: gridPadding(output, ctx, 'xs') },
        xaxis: horizontal
            ? {}
            : { labels: { rotate: -90, maxHeight: 60 } },
      },
    },
  ]
}
