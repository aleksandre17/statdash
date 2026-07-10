// ── Emit coverage — the EXPLICIT, enumerated gap boundary ──────────────
//
//  V5 realizes the CARTESIAN family of ChartOutput to SVG. Every other shape
//  is an EXPLICIT gap, enumerated here and rendered as a self-describing
//  placeholder (never a silently-wrong chart). Adding a shape = a new emitter
//  branch + moving its type from `EMIT_GAPS` to `EMITTABLE_TYPES` — the
//  interface (`emit`) never changes (OCP).
//
//  Fidelity mapping to the live dispatch (plugins/…/toApexOptions.ts):
//    buildCartesian  → bar · hbar · line · area · waterfall · combo   ← EMITTED
//    buildContribution → contribution (geometrically a vbar)          ← EMITTED
//    buildPie          → pie · donut        (radial arcs)             ← GAP
//    buildTreemap      → treemap            (squarified tiling)       ← GAP
//    buildHBarDiverging→ hbar-diverging     (n-level grouped diverge) ← GAP
//    (placeholder)     → map · sankey       (no geometry yet)         ← GAP
//

import type { ChartType } from '@statdash/engine'

/** ChartOutput types the emitter renders with full cartesian fidelity. */
export const EMITTABLE_TYPES: readonly ChartType[] = [
  'bar',
  'hbar',
  'line',
  'area',
  'waterfall',
  'combo',
  'contribution',
]

/**
 * Types deliberately NOT yet emittable, each with the reason. Rendered as a
 * labelled placeholder so an export never silently misrepresents the data.
 */
export const EMIT_GAPS: Readonly<Record<string, string>> = {
  pie:              'radial arcs — non-cartesian geometry not yet emitted',
  donut:            'radial arcs + center total — non-cartesian, not yet emitted',
  treemap:          'squarified tiling layout — not yet emitted',
  'hbar-diverging': 'n-level grouped diverging axis (groups) — not yet emitted',
  map:              'choropleth geography — no engine geometry (placeholder)',
  sankey:           'flow diagram — no engine geometry (placeholder)',
}

const EMITTABLE_SET = new Set<string>(EMITTABLE_TYPES)

/** Whether `emit` renders this ChartType as a real cartesian chart. */
export function isEmittable(type: ChartType): boolean {
  return EMITTABLE_SET.has(type)
}
