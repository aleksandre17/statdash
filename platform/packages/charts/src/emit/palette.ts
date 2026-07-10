// ── Emit-time categorical palette + per-series color resolution ────────
//
//  MIRRORS the live render layer's `buildColors` (plugins/…/cartesian/colors.ts):
//    • distributed        → each CATEGORY takes the next palette hue
//    • seriesColorByIndex → each SERIES takes palette[index]
//    • explicit           → each series' own `s.color`
//    • spacer (waterfall) → transparent
//    • per-point thresholdColor always wins (handled at the mark site)
//
//  WHY the palette is baked as literals here (not read from --chart-color-N):
//  the render layer resolves the palette via `cssVar('--chart-color-N', …)`
//  against the LIVE theme cascade. The emitter is pure and SERVER-SIDE — there
//  is no DOM, no cascade, no `var()` to resolve (Law 3: charts must not import
//  @statdash/styles). So it bakes the canonical LIGHT-mode swatches, which are
//  exactly the `cssVar` FALLBACKS the render layer itself uses under SSR/jsdom.
//  This is the same rule `colors.ts` already applies to DEFAULT_SERIES_COLOR:
//  the neutral format cannot hold a `var()`, so a literal seed is emitted.
//
//  SSOT: packages/styles/src/css/tokens.css `--chart-color-1…10` (light theme).
//  A server export is theme-agnostic by definition (light baseline); a themed
//  export would re-parameterise `emit()` with a resolved palette — an OCP seam
//  left open, not a silent divergence.
//

import { DEFAULT_SERIES_COLOR } from '../colors'
import type { ChartOutput } from '../types'

const SPACER = '__spacer__'

/** Canonical light-mode categorical palette (mirror of --chart-color-1…10). */
export const EMIT_PALETTE: readonly string[] = [
  '#005a9c', // 1  blue
  '#e8710a', // 2  orange
  '#1b9e77', // 3  teal-green
  '#d81b60', // 4  magenta
  '#7b3294', // 5  purple
  '#a17d00', // 6  mustard
  '#2b8dac', // 7  sky
  '#984ea3', // 8  violet
  '#5a9518', // 9  olive
  '#8c564b', // 10 brown
]

/** i-th categorical colour, wrapping — mirror of styles `chartColorAt`. */
export function paletteAt(i: number): string {
  const n = EMIT_PALETTE.length
  return EMIT_PALETTE[((i % n) + n) % n]!
}

/**
 * Resolve one base colour PER SERIES (index-aligned to output.series, never
 * re-sorted — the same INVARIANT the live `buildColors` documents). Per-point
 * threshold/semantic colours are layered ON TOP at the mark site.
 */
export function resolveSeriesColors(output: ChartOutput): string[] {
  const { series } = output
  if (output.distributed === true) {
    // Single-series categorical: each CATEGORY (data point) is palette-hued at
    // the mark site; the series base colour is unused, seed the first hue.
    return series.map(() => paletteAt(0))
  }
  if (output.seriesColorByIndex === true) {
    return series.map((s, i) => (s.name === SPACER ? 'transparent' : paletteAt(i)))
  }
  return series.map((s) => (s.name === SPACER ? 'transparent' : (s.color || DEFAULT_SERIES_COLOR)))
}

/**
 * Colour for a single mark (series `si`, category `ci`). Priority mirrors the
 * live pipeline: per-point thresholdColor > distributed per-category hue >
 * resolved series colour.
 */
export function markColor(output: ChartOutput, seriesColors: readonly string[], si: number, ci: number): string {
  const pt = output.series[si]?.data[ci]
  if (pt?.thresholdColor) return pt.thresholdColor
  if (output.distributed === true) return paletteAt(ci)
  return seriesColors[si] ?? DEFAULT_SERIES_COLOR
}
