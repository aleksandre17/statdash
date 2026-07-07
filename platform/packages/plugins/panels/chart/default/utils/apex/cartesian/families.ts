// ── Cartesian family descriptor — the OCP seam ─────────────────────────
//
//  The six cartesian families (bar · hbar · line · area · waterfall · combo)
//  are a CLOSED, engine-owned set. Their per-family variation is lifted OUT of
//  the slice-builders into pure type-facts here, so a slice never switches on
//  `type === 'waterfall'`; it switches on a resolved discriminant that
//  context.ts derives from these traits (× the runtime `stacked` flag).
//
//  To add a family: add the union member + ONE FAMILY_TRAITS entry (the
//  exhaustive Record makes the compiler force it). Only a genuinely new render
//  behavior needs a new enum arm in the single relevant slice — no switch in
//  the assembler, context, or any other slice grows. That is the OCP mandate.
//

import type { ChartType } from '@statdash/engine'

// ── Waterfall spacer sentinel (SSOT — kills the '__spacer__' magic string) ──
//
//  A waterfall injects transparent "spacer" series to float each bar to its
//  running base. That sentinel name is read across series / colors / fill /
//  data-labels — one const + one predicate here, no scattered literal.
//
export const SPACER = '__spacer__'
export function isSpacer(name: string): boolean {
  return name === SPACER
}

export type CartesianFamily = 'bar' | 'hbar' | 'line' | 'area' | 'waterfall' | 'combo'

/** How the mark's area is filled (resolved: `area` upgrades to `stacked-area`). */
export type FillMode = 'solid' | 'area' | 'stacked-area' | 'waterfall'
/** How the mark is stroked (resolved: `area` upgrades to `stacked-area`). */
export type StrokeMode = 'none' | 'line' | 'stacked-area' | 'combo'
/** How series are assembled (combo mixes per-series types; waterfall floats spacers). */
export type SeriesMode = 'plain' | 'combo' | 'waterfall'
/** When point markers draw. `unstacked` = only while not stacked (area). */
export type MarksRule = 'never' | 'always' | 'unstacked'

export interface FamilyTraits {
  /** ApexCharts host chart type. combo→line (mixes per-series), bar-family→bar. */
  readonly apexType:            ApexChart['type']
  readonly seriesMode:          SeriesMode
  /** Family that is always stacked regardless of the authored `stacked` flag. */
  readonly forcesStacked:       boolean
  /** Show per-bar value labels by default (override still wins). */
  readonly dataLabelsByDefault: boolean
  /** Fill baseline BEFORE the runtime stacked-area upgrade (context resolves). */
  readonly baseFill:            FillMode
  /** Stroke baseline BEFORE the runtime stacked-area upgrade (context resolves). */
  readonly baseStroke:          StrokeMode
  readonly marks:               MarksRule
  /** Continuous value axis pinned to a zero baseline + nice-scale (line/area). */
  readonly zeroBaselineAxis:    boolean
}

export const FAMILY_TRAITS: Record<CartesianFamily, FamilyTraits> = {
  bar:       { apexType: 'bar',  seriesMode: 'plain',     forcesStacked: false, dataLabelsByDefault: true,  baseFill: 'solid',     baseStroke: 'none',  marks: 'never',     zeroBaselineAxis: false },
  hbar:      { apexType: 'bar',  seriesMode: 'plain',     forcesStacked: false, dataLabelsByDefault: true,  baseFill: 'solid',     baseStroke: 'none',  marks: 'never',     zeroBaselineAxis: false },
  line:      { apexType: 'line', seriesMode: 'plain',     forcesStacked: false, dataLabelsByDefault: false, baseFill: 'solid',     baseStroke: 'line',  marks: 'always',    zeroBaselineAxis: true  },
  area:      { apexType: 'area', seriesMode: 'plain',     forcesStacked: false, dataLabelsByDefault: false, baseFill: 'area',      baseStroke: 'line',  marks: 'unstacked', zeroBaselineAxis: true  },
  waterfall: { apexType: 'bar',  seriesMode: 'waterfall', forcesStacked: true,  dataLabelsByDefault: true,  baseFill: 'waterfall', baseStroke: 'none',  marks: 'never',     zeroBaselineAxis: false },
  combo:     { apexType: 'line', seriesMode: 'combo',     forcesStacked: false, dataLabelsByDefault: false, baseFill: 'solid',     baseStroke: 'combo', marks: 'never',     zeroBaselineAxis: false },
}

const FAMILIES = Object.keys(FAMILY_TRAITS) as CartesianFamily[]

/**
 * Map a ChartType to its cartesian family. The six family names ARE the
 * ChartType strings, so this is a validated identity. The `'bar'` fallback is
 * unreachable by construction — `toApexOptions` only dispatches the six
 * cartesian types into `buildCartesian` (hbar-diverging → its own builder).
 */
export function familyOf(type: ChartType): CartesianFamily {
  return (FAMILIES as readonly string[]).includes(type) ? (type as CartesianFamily) : 'bar'
}
