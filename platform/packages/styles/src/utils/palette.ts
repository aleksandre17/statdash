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
