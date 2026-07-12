// ── tokenCatalogOptions — the design-token picker source (activates enum-ref 'tokens')
//
//  The `enum-ref source:'tokens'` discriminant has been DECLARED on the engine since
//  prop-schema.ts (PropFieldSource) but was never RESOLVED in the panel — the token
//  picker's data source lay dormant. This module activates it: it resolves style-token
//  options from `TOKENS_CATALOG` (@statdash/styles — the Self-Describing token module),
//  optionally CONSTRAINED to one `TokenGroup` (a `padding` picker → `group:'spacing'`,
//  a `color` picker → `group:'color'`). The Tailwind constraint discipline: a finite,
//  on-scale, `[data-tenant]`-themeable option set — the author PICKS a token, never
//  types a raw pixel/hex on the default path (Law 2).
//
//  The option VALUE is the token's `cssVar` string (`var(--spacing-md)`) — exactly what
//  a `NodeStyles` property serializes to, and already `[data-tenant]`-rebindable. So the
//  round-trip is a trivial identity: a stored `view.styles.padding = 'var(--spacing-md)'`
//  re-selects its picker option by value, with NO reverse-map lookup table (§3.3 of the
//  style DESIGN — "the catalog cssVar IS the identity↔value bridge").
//
//  Shared by BOTH the generic EnumRefField ('tokens' branch) and the rich StyleField
//  (one picker per style property) — one resolver, no duplication (DRY).
//
import { TOKENS_CATALOG, type TokenGroup } from '@statdash/styles'
import { readLocale } from '../inspector/localeString'
import type { Locale } from '../types/constructor'

/** One resolved token option — label already resolved to the active locale. */
export interface TokenOption {
  /** The serialized style value (the token's `cssVar`), e.g. `var(--spacing-md)`. */
  value: string
  /** The token's human label in the active locale. */
  label: string
  /** The token's catalog group — lets a consumer sub-group a mixed list. */
  group: TokenGroup
}

/** The `enum-ref` sources this module resolves (currently the one design-token source). */
export function isTokenSource(source: string | undefined): source is 'tokens' {
  return source === 'tokens'
}

/**
 * The pickable design tokens, optionally constrained to ONE group. Only tokens that
 * carry a `cssVar` (the CSS-authorable subset — non-CSS tokens like breakpoints are
 * excluded) are offered, in catalog declaration order (a stable, curated scale).
 */
export function tokenOptions(group: string | undefined, locale: Locale): TokenOption[] {
  const out: TokenOption[] = []
  for (const [, desc] of Object.entries(TOKENS_CATALOG)) {
    if (!desc.cssVar) continue
    if (group && desc.group !== group) continue
    out.push({
      value: desc.cssVar,
      label: readLocale(desc.label, locale) || desc.cssVar,
      group: desc.group,
    })
  }
  return out
}
