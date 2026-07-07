// ── Cartesian data labels ──────────────────────────────────────────────
//
//  Per-bar/point value labels. The waterfall arm paints the spacer series'
//  labels transparent (only the visible bars are labelled) — switched on the
//  resolved seriesMode, never on `type === 'waterfall'`.
//
//  INVARIANT: the waterfall per-series color array maps `output.series` IN
//  ORDER, never re-sorted — index alignment with buildSeries (spec risk #3).
//

import type { ChartOutput } from '@statdash/charts'
import type { CartesianContext } from './context'
import { yFormatter } from '../base'
import { cssVar } from '@statdash/styles'
import { isSpacer } from './families'

export function buildDataLabels(output: ChartOutput, ctx: CartesianContext): ApexDataLabels {
  const { series, axes, horizontal } = output
  const { showDataLabels, FS_XS, seriesMode } = ctx

  return {
    enabled:   showDataLabels,
    formatter: (val: number) => yFormatter(undefined, axes.y.decimals ?? 1)(val),
    offsetY:   horizontal ? 0 : -20,
    offsetX:   horizontal ? 6 : 0,
    style: {
      fontSize:   FS_XS,
      fontWeight: 600,
      colors:     seriesMode === 'waterfall'
          // waterfall: only label the visible series
          ? series.map((s) => isSpacer(s.name) ? 'transparent' : cssVar('--color-text-secondary', '#2D3748'))
          : horizontal ? [cssVar('--color-text-secondary', '#2D3748')] : [cssVar('--color-text-muted', '#6B7B8D')],
    },
    dropShadow: { enabled: false },
  }
}
