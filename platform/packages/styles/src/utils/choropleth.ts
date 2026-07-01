// ── choropleth — sequential single-hue color scale (agnostic, token-derived) ──
//
//  A choropleth shades regions by VALUE. The hue is owned by the theme
//  (--color-accent); this derives a light → saturated ramp from that ONE token,
//  so the whole scale rebrands automatically under a [data-tenant] override —
//  no per-tenant palette hexes are baked in (Law 1/4: agnostic, no privileged
//  dimension or tenant identity in the color logic).
//
//  The ramp feeds Leaflet PathOptions.fillColor — a JS-fed SVG attribute where
//  `var(--token)` is invalid — so cssVar resolves the accent/surface tokens to
//  concrete values at call time. Under SSR / jsdom / node the un-themed
//  fallbacks yield a DETERMINISTIC ramp, which the fitness guard pins.
//
//  Companion to palette.ts: that resolves the CATEGORICAL data-viz scale (one
//  distinct hue per series); this resolves the SEQUENTIAL scale (one hue, ramped
//  by magnitude). Use this for any value-shaded map / heat encoding.

import { cssVar } from './cssVar'

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('')
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/**
 * Sequential single-hue ramp (lightest → most saturated), derived from the
 * theme accent. `stops` colors: the light end is the accent mixed toward the
 * surface (a faint tint that still reads as the brand hue); the dark end is the
 * accent slightly deepened. Fully agnostic + rebrandable — both endpoints are
 * derived from tokens, no literal palette.
 */
export function sequentialRamp(stops = 5): string[] {
  if (stops < 1) return []
  const accent  = hexToRgb(cssVar('--color-accent', '#0080BE'))
  const surface = hexToRgb(cssVar('--color-surface', '#ffffff'))
  if (stops === 1) return [rgbToHex(accent[0], accent[1], accent[2])]
  const light: RGB = lerpRgb(accent, surface, 0.85)                 // faint accent tint
  const dark:  RGB = [accent[0] * 0.88, accent[1] * 0.88, accent[2] * 0.88]  // deepened accent
  return Array.from({ length: stops }, (_, i) => {
    const t = i / (stops - 1)
    const [r, g, b] = lerpRgb(light, dark, t)
    return rgbToHex(r, g, b)
  })
}

/**
 * Assign a ramp color to each value by QUANTILE rank (equal-count buckets), so a
 * skewed spread (one dominant region, many small) still spans the full ramp —
 * the flat-map failure mode a naive linear scale falls into. Pure + deterministic
 * given `ramp`; the returned array is index-aligned with the input `values`.
 */
export function quantileColors(values: number[], ramp: string[]): string[] {
  const n = ramp.length
  if (values.length === 0 || n === 0) return values.map(() => ramp[0] ?? '')
  const ranked = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const out = new Array<string>(values.length)
  ranked.forEach(({ i }, rank) => {
    const bucket = Math.min(n - 1, Math.floor((rank / ranked.length) * n))
    out[i] = ramp[bucket]!
  })
  return out
}
