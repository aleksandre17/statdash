// ── Cartesian grid ─────────────────────────────────────────────────────
//
//  Gridlines follow the hidden-axis SSOT (a hidden axis drops its own lines,
//  the visible axis keeps ApexCharts' default). Padding is a per-breakpoint-tier
//  SSOT (gridPadding) reused by responsive.ts, so the padding math lives once.
//
//  Top padding keeps above-bar data labels + line markers inside the chart
//  bounds; horizontal bars place their value label OUTSIDE the bar end, so the
//  right padding + hbarValueMax scale headroom keep the longest end-label inside
//  the SVG (F10/F13 clip).
//

import type { ChartOutput } from '@statdash/charts'
import type { CartesianContext } from './context'
import { BASE } from '../base'

export type GridTier = 'base' | 'md' | 'sm' | 'xs'

interface TierPad {
  readonly left:         number
  readonly rightHLabel:  number   // horizontal + data labels (out-of-bar end-label room)
  readonly rightHBare:   number   // horizontal, no labels
  readonly rightV:       number   // vertical
  readonly topStacked:   number
  readonly topLabel:     number   // above-bar labels (vertical only)
  readonly topBase:      number
  readonly labelsActive: boolean  // labels are disabled at the xs tier
}

const PAD: Record<GridTier, TierPad> = {
  base: { left: 4, rightHLabel: 44, rightHBare: 8, rightV: 20, topStacked: 40, topLabel: 24, topBase: 6, labelsActive: true },
  md:   { left: 4, rightHLabel: 40, rightHBare: 4, rightV: 14, topStacked: 30, topLabel: 18, topBase: 5, labelsActive: true },
  sm:   { left: 2, rightHLabel: 34, rightHBare: 2, rightV: 10, topStacked: 22, topLabel: 14, topBase: 4, labelsActive: true },
  xs:   { left: 0, rightHLabel: 0,  rightHBare: 0, rightV: 6,  topStacked: 16, topLabel: 4,  topBase: 4, labelsActive: false },
}

/** Grid padding for a breakpoint tier. SSOT for the base grid + every responsive override. */
export function gridPadding(output: ChartOutput, ctx: CartesianContext, tier: GridTier): { left: number; right: number; top: number } {
  const p = PAD[tier]
  const { horizontal } = output
  const { showDataLabels, isStackedArea } = ctx
  const labels = p.labelsActive && showDataLabels
  return {
    left:  p.left,
    right: horizontal ? (labels ? p.rightHLabel : p.rightHBare) : p.rightV,
    top:   isStackedArea ? p.topStacked : (labels && !horizontal ? p.topLabel : p.topBase),
  }
}

export function buildGrid(output: ChartOutput, ctx: CartesianContext): ApexGrid {
  const { apexXHidden, apexYHidden } = ctx
  return {
    ...BASE.grid,
    // A hidden axis takes its gridlines with it (only that axis's lines are
    // overridden — the visible axis keeps its ApexCharts default so a vertical
    // chart's horizontal grid, or an hbar's vertical grid, is untouched).
    ...(apexXHidden ? { xaxis: { lines: { show: false } } } : {}),
    ...(apexYHidden ? { yaxis: { lines: { show: false } } } : {}),
    padding: gridPadding(output, ctx, 'base'),
  }
}
