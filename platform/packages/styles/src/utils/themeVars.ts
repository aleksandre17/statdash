// ── themeVars — brand token overrides → CSS custom properties ─────────────────
//
//  The ONE platform mechanism that turns declarative brand DATA (a flat
//  `tokenKey → CSS value` map — `SiteManifest.themeOverrides` / `SiteDef.
//  themeOverrides`) into applied CSS custom properties. It lives HERE, in the
//  token-owning package, so BOTH consumers use the same transform without either
//  importing the other (Law 3 — the runner app cannot import the Constructor app,
//  and vice versa):
//    - the Constructor canvas (apps/panel) feeds `buildThemeVars(overrides)` as the
//      inline style of its canvas root, so the previewed site's brand paints true;
//    - the runner app calls `applyThemeOverrides(overrides)` at boot, so the
//      PUBLISHED site's brand flows from the manifest, not baked tenant CSS.
//  Same map + same transform ⇒ the canvas is provably faithful to the runner
//  ("the canvas never lies").
//
//  Why data, not code (Law 2): a theme is a value map; the tokenKey↔CSS-var mapping
//  is READ from the self-describing TOKENS_CATALOG (`descriptor.cssVar`), so a NEW
//  brand token becomes applicable with zero change here (Law 8, open for extension).

import { TOKENS_CATALOG } from '../tokens-catalog'

/**
 * The raw custom-property name a token maps to: `'color.accent'` → `'--color-accent'`.
 * Derived from the catalog's `cssVar` ('var(--color-accent)'). Returns `null` for
 * tokens with no CSS variable (e.g. breakpoints/aspect literals) or unknown keys —
 * such tokens are not applicable and are skipped by `buildThemeVars`.
 */
export function cssVarName(tokenKey: string): string | null {
  const cssVar = TOKENS_CATALOG[tokenKey]?.cssVar
  const m = cssVar?.match(/^var\((--[^)]+)\)$/)
  return m ? m[1] : null
}

/**
 * Compose ordered `tokenKey → value` layers into a flat custom-property map
 * (`--css-var → value`). LATER layers win (call as `buildThemeVars(base, overrides)`
 * so author overrides beat the base). Empty values and non-CSS/unknown tokens are
 * skipped, so an author clearing a field falls back to the layer beneath. Returned as
 * a plain `Record<string, string>` (framework-neutral — the styles package stays
 * React-free); a React caller casts it to `CSSProperties` at the use site.
 */
export function buildThemeVars(...layers: Record<string, string>[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value === '' || value == null) continue
      const name = cssVarName(key)
      if (name) out[name] = value
    }
  }
  return out
}

/** The id of the single runtime `<style>` element `applyThemeOverrides` maintains. */
export const THEME_OVERRIDES_STYLE_ID = 'statdash-theme-overrides'

/**
 * Serialize a brand override map into a `:root { … }` CSS rule string. The selector
 * is a SINGLE `:root` (specificity 0,1,0) DELIBERATELY: it must LOSE to a mode
 * override like `[data-theme="dark"]` (0,2,0) so applying a light-tuned brand map
 * never freezes the dark cascade (the source-order/specificity trap documented in the
 * tenant-dark cascade gap). Against a same-specificity base `[data-tenant]` rule it
 * wins by source order (injected at runtime, after the bundled CSS) — so the brand
 * flows from config in the mode it targets, without fighting the mode cascade.
 */
export function themeOverridesCss(overrides: Record<string, string>): string {
  const vars = buildThemeVars(overrides)
  const body = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')
  return body ? `:root{${body}}` : ''
}

/**
 * Apply a brand override map to a document by maintaining ONE `<style>` element in
 * `<head>` (idempotent — re-applying replaces its content, never stacks). Injected as
 * a `:root` STYLESHEET rule (not inline on the element) so it composes with the mode
 * cascade: a `[data-theme="dark"]` override still wins by specificity (see
 * `themeOverridesCss`). Returns the managed element (or `null` for an empty map / no
 * DOM — SSR-safe). This is how the runner applies `manifest.themeOverrides` at boot;
 * the Constructor canvas uses `buildThemeVars` inline instead (a scoped preview root).
 */
export function applyThemeOverrides(
  overrides: Record<string, string> | undefined,
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): HTMLStyleElement | null {
  if (!doc) return null
  const css = overrides ? themeOverridesCss(overrides) : ''
  let el = doc.getElementById(THEME_OVERRIDES_STYLE_ID) as HTMLStyleElement | null
  if (!css) {
    el?.remove()
    return null
  }
  if (!el) {
    el = doc.createElement('style')
    el.id = THEME_OVERRIDES_STYLE_ID
    doc.head.appendChild(el)
  }
  el.textContent = css
  return el
}
