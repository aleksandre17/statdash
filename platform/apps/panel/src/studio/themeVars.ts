// ── themeVars — token overrides → inline CSS custom properties ────────────────
//
//  The live-preview engine of the Style editor (AR-49 M1.4). It is the ONE place
//  that turns declarative token DATA (a `tokenKey → CSS value` map — the Strata
//  preset and `SiteDef.themeOverrides`) into the inline custom-property style the
//  shell root carries. Because every chrome element AND the live canvas descend
//  from that root, and custom properties inherit, writing a new map repaints the
//  whole tool on the next render — no imperative DOM poking, no theme code path
//  (Law 2: theme is data, logic stays in the renderer/cascade).
//
//  The tokenKey ⇄ custom-property mapping is NOT hand-maintained: it reads the
//  self-describing TOKENS_CATALOG (`descriptor.cssVar` = 'var(--x)'), so a new
//  token becomes previewable with zero change here (Law 8, open for extension).

import type { CSSProperties } from 'react'
import { TOKENS_CATALOG } from '@statdash/styles'

/**
 * The raw custom-property name a token maps to: `'color.accent'` → `'--color-accent'`.
 * Derived from the catalog's `cssVar` ('var(--color-accent)'). Returns `null` for
 * tokens with no CSS variable (e.g. breakpoints/aspect literals) or unknown keys —
 * such tokens are not previewable and are skipped by `buildThemeVars`.
 */
export function cssVarName(tokenKey: string): string | null {
  const cssVar = TOKENS_CATALOG[tokenKey]?.cssVar
  const m = cssVar?.match(/^var\((--[^)]+)\)$/)
  return m ? m[1] : null
}

/**
 * Compose ordered `tokenKey → value` layers into an inline custom-property style
 * object. LATER layers win (call as `buildThemeVars(STRATA_PRESET, themeOverrides)`
 * so author overrides beat the Strata base). Empty values and non-CSS/unknown
 * tokens are skipped, so an author clearing a field falls back to the layer beneath.
 */
export function buildThemeVars(...layers: Record<string, string>[]): CSSProperties {
  const out: Record<string, string> = {}
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value === '' || value == null) continue
      const name = cssVarName(key)
      if (name) out[name] = value
    }
  }
  return out as CSSProperties
}
