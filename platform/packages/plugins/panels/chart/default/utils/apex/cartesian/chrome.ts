// ── Cartesian chrome — legend · tooltip · annotations ──────────────────
//
//  Small non-plot slices. The tooltip's shared/waterfall arm switches on the
//  resolved seriesMode, never on `type === 'waterfall'`.
//

import type { ChartOutput } from '@statdash/charts'
import type { CartesianContext } from './context'
import { BASE } from '../base'
import { cssVar } from '@statdash/styles'

export function buildLegend(output: ChartOutput, ctx: CartesianContext, fontFamily?: string): ApexLegend {
  return {
    show:       output.legend.show,
    position:   output.legend.position ?? 'bottom',
    fontFamily: fontFamily ?? 'system-ui, sans-serif',
    fontSize:   ctx.FS_MD,
    labels:     { colors: cssVar('--color-text-secondary', '#4A5568') },
    markers:    { size: 6 },
    itemMargin: { horizontal: 12 },
  }
}

export function buildTooltip(output: ChartOutput, ctx: CartesianContext): ApexTooltip {
  const { horizontal } = output
  const { formatted, seriesMode } = ctx
  return {
    ...BASE.tooltip,
    enabled:   output.tooltip.show,
    // hbar: shared=true groups by x-position (value axis) → all bars show same name.
    // Use shared=false + intersect=true so each bar shows its own category label.
    // waterfall: shared=false too (spacer series would appear in grouped tooltip).
    // output.tooltip.shared overrides the type-default when explicitly set.
    shared:    output.tooltip.shared ?? (!horizontal && seriesMode !== 'waterfall'),
    intersect: horizontal,
    y: {
      formatter: (_val, opts) =>
          formatted[opts.seriesIndex]?.[opts.dataPointIndex] ?? String(_val),
    },
  }
}

export function buildAnnotations(ctx: CartesianContext): ApexAnnotations {
  const { yMax } = ctx
  return yMax != null ? {
    yaxis: [{
      y:               yMax,
      strokeDashArray: 4,
      borderColor:     cssVar('--color-text-faint', '#94A3B8'),
      borderWidth:     1.5,
      label:           { text: '' },
    }],
  } : {}
}
