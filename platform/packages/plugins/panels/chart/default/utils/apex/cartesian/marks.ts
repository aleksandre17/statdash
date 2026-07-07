// ── Cartesian marks — how the mark draws ───────────────────────────────
//
//  plotOptions.bar + fill + stroke + markers are one cohesive slice: they are
//  driven by the same family logic (fillMode / strokeMode / showMarkers), so
//  they live together and each switches on a RESOLVED discriminant, never on
//  `type === 'waterfall'`.
//
//  INVARIANT: the per-series arrays (fill.opacity, stroke.width, stroke.colors)
//  map `output.series` IN ORDER, never re-sorted — index alignment with
//  buildSeries / buildColors depends on it (spec risk #3).
//

import type { ChartOutput } from '@statdash/charts'
import type { CartesianContext } from './context'
import type { StrokeMode } from './families'
import { isSpacer } from './families'
import { cssVar } from '@statdash/styles'

// Stroke width per stroke-mode × responsive tier. combo carries a per-series
// width (line width vs 0 for bars); every other mode is a scalar. SSOT so the
// responsive breakpoint re-carry (responsive.ts) never drifts from the base.
const STROKE_WIDTH: Record<StrokeMode, { base: number; md: number; sm: number }> = {
  none:           { base: 0,   md: 0,   sm: 0 },
  line:           { base: 3,   md: 2.5, sm: 2 },
  'stacked-area': { base: 2,   md: 1.5, sm: 1 },
  combo:          { base: 2.5, md: 2,   sm: 2 },
}

/** Stroke width for a tier — a per-series array in combo, a scalar otherwise. */
export function strokeWidth(output: ChartOutput, ctx: CartesianContext, tier: 'base' | 'md' | 'sm'): number | number[] {
  const w = STROKE_WIDTH[ctx.strokeMode][tier]
  return ctx.strokeMode === 'combo'
      ? output.series.map((s) => (s.seriesType ?? 'bar') === 'line' ? w : 0)
      : w
}

/**
 * ApexCharts sizes a bar as a % of its per-category slot (barHeight for
 * horizontal, columnWidth for vertical), derived from an absolute thickness cap
 * (see base.ts): a solo/2-bar chart reads as a focus bar with whitespace, many
 * bars fill their slots up to a gap-preserving ceiling.
 */
export function buildBarPlotOptions(output: ChartOutput, ctx: CartesianContext): ApexPlotOptions {
  const { horizontal } = output
  return {
    bar: {
      distributed:  output.distributed === true,
      horizontal:   horizontal,
      borderRadius: horizontal ? 3 : 4,
      ...(horizontal
          ? { barHeight: ctx.barFill }
          : { columnWidth: ctx.barFill }),
      dataLabels:   { position: 'top' },
    },
  }
}

export function buildMarks(output: ChartOutput, ctx: CartesianContext): { fill: ApexFill; stroke: ApexStroke; markers: ApexMarkers } {
  return {
    fill:    buildFill(output, ctx),
    stroke:  buildStroke(output, ctx),
    markers: buildMarkers(ctx),
  }
}

function buildFill(output: ChartOutput, ctx: CartesianContext): ApexFill {
  switch (ctx.fillMode) {
    // waterfall: spacer series transparent, real bars opaque
    case 'waterfall':    return { opacity: output.series.map((s) => isSpacer(s.name) ? 0 : 1) }
    case 'stacked-area': return { opacity: 0.88 }
    case 'area':         return { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.65, opacityTo: 0.1, stops: [0, 90] } }
    case 'solid':        return { opacity: 1 }
  }
}

function buildStroke(output: ChartOutput, ctx: CartesianContext): ApexStroke {
  return {
    width:  strokeWidth(output, ctx, 'base'),
    // stacked area: white stroke separates areas and makes the top line visible
    colors: ctx.strokeMode === 'stacked-area' ? output.series.map(() => cssVar('--color-surface', '#ffffff')) : undefined,
    curve:  'smooth',
  }
}

function buildMarkers(ctx: CartesianContext): ApexMarkers {
  return ctx.showMarkers
      ? { size: 5, strokeWidth: 2, strokeColors: cssVar('--color-surface', '#fff'), hover: { size: 7 } }
      : {}
}
