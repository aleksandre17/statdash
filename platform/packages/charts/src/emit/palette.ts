// ── Emit-time categorical palette + per-series color resolution ────────
//
//  MIRRORS the live render layer's `buildColors` (plugins/…/cartesian/colors.ts):
//    • distributed        → each CATEGORY takes the next palette hue
//    • seriesColorByIndex → each SERIES takes palette[index]
//    • explicit           → each series' own `s.color`
//    • spacer (waterfall) → transparent
//    • per-point thresholdColor always wins (handled at the mark site)
//
//  WHY each entry references a token (not a bare literal): the categorical
//  palette IS a design-token set — `--chart-color-1…10` in the SSOT
//  (packages/styles/src/css/tokens.css). The emitter writes SVG presentation
//  attributes where CSS `var()` is invalid, so it resolves each token through
//  the charts-local `cssVar('--chart-color-N', <light fallback>)`: theme-aware
//  where a cascade exists, the canonical LIGHT-mode value under server/SSR emit.
//  The literals below are ONLY the token FALLBACKS — byte-identical to the
//  tokens.css light theme — kept next to their token so a drift is visible and
//  the FF-TOKEN-ONLY cohesion gate is satisfied (a bare hex would fail; a
//  cssVar-paired fallback is the sanctioned home). Law 3 stays intact: charts
//  does NOT import @statdash/styles — the value SSOT is still single, only the
//  tiny resolver is charts-local (see ./cssVar).
//

import { DEFAULT_SERIES_COLOR } from '../colors'
import { cssVar } from './cssVar'
import type { ChartOutput } from '../types'

const SPACER = '__spacer__'

/**
 * Categorical palette — the `--chart-color-1…10` token set, resolved for the
 * emit path (theme-aware in a browser cascade; light-mode fallback under SSR).
 */
export const EMIT_PALETTE: readonly string[] = [
  cssVar('--chart-color-1',  '#005a9c'), // 1  blue
  cssVar('--chart-color-2',  '#e8710a'), // 2  orange
  cssVar('--chart-color-3',  '#1b9e77'), // 3  teal-green
  cssVar('--chart-color-4',  '#d81b60'), // 4  magenta
  cssVar('--chart-color-5',  '#7b3294'), // 5  purple
  cssVar('--chart-color-6',  '#a17d00'), // 6  mustard
  cssVar('--chart-color-7',  '#2b8dac'), // 7  sky
  cssVar('--chart-color-8',  '#984ea3'), // 8  violet
  cssVar('--chart-color-9',  '#5a9518'), // 9  olive
  cssVar('--chart-color-10', '#8c564b'), // 10 brown
]

/** i-th categorical colour, wrapping — mirror of styles `chartColorAt`. */
export function paletteAt(i: number): string {
  const n = EMIT_PALETTE.length
  return EMIT_PALETTE[((i % n) + n) % n]!
}

// ── Sequential single-hue ramp (emit twin of styles `chartSequential`) ──────
//
//  MIRROR of packages/styles `SEQUENTIAL` (--chart-seq-1…7). The emit path is
//  outside the arrow-forbidden styles import (Law 3), so it owns a charts-local
//  twin resolved through the charts-local cssVar — byte-identical light-mode
//  fallbacks, theme-aware where a browser cascade exists (see EMIT_PALETTE). A
//  `palette: "sequential"` chart (portal share bars / GDP dynamics) now renders
//  the SAME blue ramp on the SSR/export SVG as the live ApexCharts realizer —
//  the two-realizer colour parity the live buildColors already holds.
//
const EMIT_SEQUENTIAL: readonly string[] = [
  cssVar('--chart-seq-1', '#cfe8f5'),
  cssVar('--chart-seq-2', '#a6d3ec'),
  cssVar('--chart-seq-3', '#6fb7de'),
  cssVar('--chart-seq-4', '#3f9bd0'),
  cssVar('--chart-seq-5', '#0080be'),
  cssVar('--chart-seq-6', '#005f8f'),
  cssVar('--chart-seq-7', '#003f60'),
]

// Ramp index used as the uniform anchor for a plain single-series sequential
// chart (mirror of colors.ts SEQ_ANCHOR — the accent-blue class --chart-seq-5).
const SEQ_ANCHOR = 4

/**
 * `count` ordered colours SAMPLED across the sequential ramp so N categories
 * span the whole light→dark reading. Mirror of styles `chartSequentialSample`.
 */
export function sequentialSample(count: number): string[] {
  const ramp = EMIT_SEQUENTIAL
  const n = Math.max(1, Math.floor(count))
  if (n === 1) return [ramp[Math.floor((ramp.length - 1) / 2)]!]
  return Array.from({ length: n }, (_, i) => {
    const pos = Math.round((i * (ramp.length - 1)) / (n - 1))
    return ramp[((pos % ramp.length) + ramp.length) % ramp.length]!
  })
}

/**
 * Resolve one base colour PER SERIES (index-aligned to output.series, never
 * re-sorted — the same INVARIANT the live `buildColors` documents). Per-point
 * threshold/semantic colours are layered ON TOP at the mark site.
 */
export function resolveSeriesColors(output: ChartOutput): string[] {
  const { series } = output
  const sequential = output.palette === 'sequential'

  // ── Sequential single-hue ramp (mirror of live colors.ts buildColors) ───────
  //  distributed  → per-CATEGORY at the mark site (seed the series base here);
  //  by-index      → each SERIES sampled across the ramp;
  //  plain         → the ramp anchor (honest uniform accent blue).
  if (sequential) {
    if (output.distributed === true) return series.map(() => EMIT_SEQUENTIAL[SEQ_ANCHOR]!)
    if (output.seriesColorByIndex === true) {
      const sampled = sequentialSample(series.length)
      return series.map((s, i) => (s.name === SPACER ? 'transparent' : sampled[i]!))
    }
    return series.map((s) => (s.name === SPACER ? 'transparent' : EMIT_SEQUENTIAL[SEQ_ANCHOR]!))
  }

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
  if (output.distributed === true) {
    // Sequential distributed: each CATEGORY takes its class SAMPLED across the
    // blue ramp (gradient by class), spanning the whole light→dark reading —
    // mirror of live colors.ts chartSequentialSample. Categorical: cycle hues.
    if (output.palette === 'sequential') {
      const count = output.categories.length || output.series[0]?.data.length || 1
      return sequentialSample(count)[ci] ?? seriesColors[si] ?? DEFAULT_SERIES_COLOR
    }
    return paletteAt(ci)
  }
  return seriesColors[si] ?? DEFAULT_SERIES_COLOR
}
