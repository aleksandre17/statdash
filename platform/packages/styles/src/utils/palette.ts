// ── Categorical chart palette resolver ─────────────────────────────────
//
//  The categorical data-viz palette is defined once as CSS vars
//  (--chart-color-1…10) with the TS map CHART_COLOR and Panel swatches in
//  DATA_COLOR_TOKENS (the SSOT). Charts that paint to SVG / do JS colour math
//  (treemap tiles, ApexCharts `distributed` series) cannot pass `var(--token)`
//  — those contexts need a concrete value. This resolves the palette to live
//  computed colours via cssVar at render time (theme-aware: dark mode remaps
//  the vars in tokens.css), falling back to the canonical light-mode swatches
//  under SSR / jsdom.
//
//  Use for ANY high-cardinality categorical chart where each datum needs a
//  distinct hue from the platform's deuteranopia-tuned scale — never invent a
//  local colour list.
//

import { CHART_COLOR }       from '../tokens/color'
import { DATA_COLOR_TOKENS } from '../catalog/data-color'
import { cssVar }            from './cssVar'

// Derive { varName, fallback } per series from the SSOT: the CSS var name is
// parsed out of CHART_COLOR's `var(--chart-color-N)` reference; the fallback is
// that token's light-mode swatch in DATA_COLOR_TOKENS. No hexes are re-typed.
const PALETTE: ReadonlyArray<{ name: `--${string}`; fallback: string }> =
  (Object.entries(CHART_COLOR) as Array<[keyof typeof CHART_COLOR, string]>).map(
    ([key, varRef]) => ({
      // 'var(--chart-color-1)' → '--chart-color-1'
      name:     varRef.slice(4, -1) as `--${string}`,
      fallback: String(DATA_COLOR_TOKENS[`chart-color.${key}`]?.value ?? '#005a9c'),
    }),
  )

/** Number of distinct categorical colours before the scale wraps. */
export const CHART_PALETTE_SIZE = PALETTE.length

/** Resolve the full categorical palette to concrete colour values (render time). */
export function chartPalette(): string[] {
  return PALETTE.map(({ name, fallback }) => cssVar(name, fallback))
}

/** Resolve the i-th categorical colour, wrapping around the palette. */
export function chartColorAt(i: number): string {
  const p = PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]
  return cssVar(p.name, p.fallback)
}

// ── Sequential single-hue palette ──────────────────────────────────────
//
//  The ordered blue ramp (--chart-seq-1…7, tokens.css). Unlike the categorical
//  scale (maximise pairwise separation), a sequential ramp encodes a SINGLE
//  quantity split into ordered classes — the parts-of-a-whole reading a donut /
//  share bar wants. Selected declaratively per chart (`palette: "sequential"`);
//  resolved theme-aware via cssVar here, exactly like chartPalette().
//
const SEQUENTIAL: ReadonlyArray<{ name: `--${string}`; fallback: string }> = [
  { name: '--chart-seq-1', fallback: '#cfe8f5' },
  { name: '--chart-seq-2', fallback: '#a6d3ec' },
  { name: '--chart-seq-3', fallback: '#6fb7de' },
  { name: '--chart-seq-4', fallback: '#3f9bd0' },
  { name: '--chart-seq-5', fallback: '#0080be' },
  { name: '--chart-seq-6', fallback: '#005f8f' },
  { name: '--chart-seq-7', fallback: '#003f60' },
]

/** Number of classes in the sequential ramp. */
export const CHART_SEQUENTIAL_SIZE = SEQUENTIAL.length

/** Resolve the full sequential ramp to concrete colour values (render time). */
export function chartSequential(): string[] {
  return SEQUENTIAL.map(({ name, fallback }) => cssVar(name, fallback))
}

/**
 * Resolve `count` ordered colours SAMPLED across the sequential ramp, so N
 * categories span the whole light→dark reading (not just the first N classes).
 * count ≤ 1 → the mid class; count ≥ ramp size → wraps back through the ramp.
 */
export function chartSequentialSample(count: number): string[] {
  const ramp = chartSequential()
  const n = Math.max(1, Math.floor(count))
  if (n === 1) return [ramp[Math.floor((ramp.length - 1) / 2)]!]
  return Array.from({ length: n }, (_, i) => {
    const pos = Math.round((i * (ramp.length - 1)) / (n - 1))
    return ramp[((pos % ramp.length) + ramp.length) % ramp.length]!
  })
}
