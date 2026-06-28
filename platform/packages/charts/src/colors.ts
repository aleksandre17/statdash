// ── Neutral-format default colors ─────────────────────────────────────
//
//  ChartOutput is renderer-agnostic, so an interpreter cannot reference a CSS
//  `var(--token)` for a fallback fill — the neutral format is JSON, parsed in
//  contexts (SVG attrs, JS color math) where `var()` is invalid. When a DataRow
//  carries no explicit color, the interpreter emits one of these literal hex
//  seeds, named once here instead of re-typed at every interpreter site (DRY).
//
//  These are deliberately BRAND-NEUTRAL: a desaturated slate grey and the
//  universal "total/action" red. They MUST NOT carry any tenant's brand value —
//  the themed ACCENT is owned by the render layer, where the apex adapter
//  resolves `cssVar('--color-accent', …)` against the active [data-tenant]
//  theme (geostat → its blue; an unstyled tenant → a neutral fallback). Baking
//  a brand accent here would render one tenant's identity for everyone; the
//  FF-TOKEN-ONLY gate (token-cohesion.fitness) now scans this file to forbid it.
//

/** Default series / bar fill when a DataRow supplies no color. Neutral slate grey. */
export const DEFAULT_SERIES_COLOR = '#6B7B8D'

/** Default fill for the rollup total bar (contribution '=' row). Action red. */
export const DEFAULT_TOTAL_COLOR = '#E53E3E'
