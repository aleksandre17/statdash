// ── tokenColor — resolve a semantic-token KEY to its themeable colour ─────────
//
//  The binding between a declarative value-mapping (config carries a token KEY, e.g.
//  'status.positive-fg') and the semantic-token spine. Consumers (table/kpi/chart
//  status cells) call this to turn the key into a CSS `var(--…)` reference — so the
//  colour stays tenant-overridable and contrast-governed (never a literal hex).
//
//  Two sinks, mirroring cssVar's rationale:
//    • tokenCssVar(key)        → 'var(--status-positive-fg)' for CSS `style`/`color`.
//    • tokenColorLiteral(key)  → the COMPUTED literal, for SVG attrs / JS-parsed colour
//                                (ApexCharts), where `var()` is invalid.
//
//  isRegisteredColorToken(key) is the FITNESS predicate: a value-mapping colour is
//  valid iff it is a registered colour-group token (no literal hex can pass).
//
import { TOKENS_CATALOG } from '../tokens-catalog'
import { cssVar }         from './cssVar'

/** Token groups that carry a colour (eligible as a value-mapping colour). */
const COLOUR_GROUPS = new Set(['gray', 'status', 'chart', 'color', 'trend'])

/** The CSS `var(--…)` reference for a token key, or undefined if unknown. */
export function tokenCssVar(key: string): string | undefined {
  return TOKENS_CATALOG[key]?.cssVar
}

/** True ⟺ `key` is a registered colour-group token (the FF-VALUE-MAPPING predicate). */
export function isRegisteredColorToken(key: string): boolean {
  const d = TOKENS_CATALOG[key]
  return !!d && !!d.cssVar && COLOUR_GROUPS.has(d.group)
}

/**
 * The COMPUTED literal colour for a token key — for SVG presentation attributes and
 * JS-parsed colours where CSS `var()` is invalid (mirrors cssVar). Falls back to the
 * descriptor's `value` hint (jsdom/SSR), then to `fallback`.
 */
export function tokenColorLiteral(key: string, fallback: string): string {
  const d = TOKENS_CATALOG[key]
  if (!d?.cssVar) return fallback
  const name = /var\((--[^)]+)\)/.exec(d.cssVar)?.[1] as `--${string}` | undefined
  const hint = d.value !== undefined ? String(d.value) : fallback
  return name ? cssVar(name, hint) : hint
}
