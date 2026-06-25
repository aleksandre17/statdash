// ── Neutral-format default colors ─────────────────────────────────────
//
//  ChartOutput is renderer-agnostic, so an interpreter cannot reference a CSS
//  `var(--token)` for a fallback fill — the neutral format is JSON, parsed in
//  contexts (SVG attrs, JS color math) where `var()` is invalid. When a DataRow
//  carries no explicit color, the interpreter emits one of these literal hex
//  defaults. The apex adapter (in @statdash/plugins) layers the themed cssVar
//  fallback ON TOP at render time; these are the wire-safe seeds, named once
//  here instead of being re-typed at every interpreter site (DRY / SSOT).
//

/** Default series / bar fill when a DataRow supplies no color. Neutral grey. */
export const DEFAULT_SERIES_COLOR = '#6B7B8D'

/** Default accent fill for single-series charts (treemap / contribution). */
export const DEFAULT_ACCENT_COLOR = '#0080BE'

/** Default fill for the rollup total bar (contribution '=' row). Action red. */
export const DEFAULT_TOTAL_COLOR = '#E53E3E'
