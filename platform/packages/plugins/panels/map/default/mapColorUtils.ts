// ── mapColorUtils — choropleth color scale builder ────────────────────
//
//  Pure utility — no React, no store, no side effects.
//  Converts an EngineRow[] + field names to a color map: dimCode → CSS color.
//
//  Three scale types (matching Mapbox / Vega-Lite / Observable Plot conventions):
//    quantile  — sort values, divide into N equal-count buckets (default).
//    linear    — interpolate R/G/B between first and last palette color.
//    threshold — N−1 equal-width thresholds between min and max.
//
//  Law 1: geoDim and valueField are plain strings — no geographic semantics here.
//

import type { EngineRow } from '@statdash/engine'

// ── Defaults ──────────────────────────────────────────────────────────

/** Default 5-stop sequential blue palette (colorblind-safe, WCAG AA contrast). */
export const DEFAULT_PALETTE: string[] = [
  '#c6dbef',
  '#9ecae1',
  '#6baed6',
  '#3182bd',
  '#08519c',
]

// ── Color interpolation helpers ───────────────────────────────────────

/** Parse a CSS hex color (#rgb or #rrggbb) to an [r, g, b] triple. */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  // Expand 3-digit shorthand (#abc → #aabbcc)
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

/** Convert [r, g, b] to a CSS hex string. */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Linearly interpolate between two hex colors.
 * t = 0 → colorA; t = 1 → colorB.
 */
function lerp(colorA: string, colorB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(colorA)
  const [r2, g2, b2] = hexToRgb(colorB)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

// ── buildColorScale ───────────────────────────────────────────────────

/**
 * Build a choropleth color map: dimCode → CSS color string.
 *
 * @param rows        Engine rows — must contain geoDim + valueField fields.
 * @param geoDim      Field name holding the geographic dimension code.
 * @param valueField  Field name holding the numeric value to color by.
 * @param palette     Ordered color array (lightest → darkest convention).
 * @param scale       Scale algorithm: 'quantile' | 'linear' | 'threshold'.
 * @returns           Map<dimCode, cssColor> — empty when rows is empty.
 */
export function buildColorScale(
  rows:       EngineRow[],
  geoDim:     string,
  valueField: string,
  palette:    string[],
  scale:      'linear' | 'quantile' | 'threshold',
): Map<string | number, string> {
  const result = new Map<string | number, string>()

  if (rows.length === 0 || palette.length === 0) return result

  // Extract (dimCode, value) pairs — skip rows missing either field.
  type Pair = { code: string | number; value: number }
  const pairs: Pair[] = rows.flatMap(row => {
    const code  = row[geoDim]
    const raw   = row[valueField]
    if (code === undefined || raw === undefined) return []
    return [{ code: code as string | number, value: Number(raw) }]
  })

  if (pairs.length === 0) return result

  const n = palette.length

  if (scale === 'linear') {
    // Interpolate between palette[0] and palette[n-1] by value position.
    const values = pairs.map(p => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min

    for (const { code, value } of pairs) {
      const t = range === 0 ? 0 : (value - min) / range
      result.set(code, lerp(palette[0], palette[n - 1], t))
    }
    return result
  }

  if (scale === 'threshold') {
    // N−1 equal-width breakpoints between min and max.
    const values = pairs.map(p => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min

    for (const { code, value } of pairs) {
      let bucketIdx: number
      if (range === 0) {
        bucketIdx = 0
      } else {
        // interval width = range / n; bucket = floor((value - min) / width)
        bucketIdx = Math.min(n - 1, Math.floor(((value - min) / range) * n))
      }
      result.set(code, palette[bucketIdx])
    }
    return result
  }

  // Default: quantile — sort values, divide into n equal-count buckets.
  const sorted = [...pairs].sort((a, b) => a.value - b.value)
  const total  = sorted.length

  for (let i = 0; i < total; i++) {
    // Assign bucket by rank position: bucket = floor(i / total * n), capped at n-1.
    const bucketIdx = Math.min(n - 1, Math.floor((i / total) * n))
    result.set(sorted[i].code, palette[bucketIdx])
  }

  return result
}
