// ── useActiveLocales — the active locale list for LocaleString authoring ────
//
//  Single source of truth for "which locales must an author fill in?".
//  V13/V14 gold enforces LocaleString COMPLETENESS — a localized field must
//  carry every active locale, not just the default. The Inspector's LocaleField
//  renders one input per active locale, so it needs this list.
//
//  Source of truth (SSOT, Law 1): the site's `activeLocales` — the ORDERED
//  projection of `config.locale` (the bootstrap locale registry), surfaced to
//  the panel through the site read (`fromApiSite`). The panel narrows those
//  opaque registry codes to its known `Locale` universe (PLATFORM_LOCALES).
//
//  Graceful degradation (Postel's Law) — `activeLocales` can be empty on the
//  mock-data fallback path (API unreachable) or an older payload. The fallback
//  chain, in order: site activeLocales → [defaultLocale] → PLATFORM_LOCALES, so
//  LocaleField NEVER authors against an empty set.
//
import type { Locale } from '../types/constructor'
import { useSite } from '../store/constructor.store'

/** The panel's known locale universe — used to narrow registry codes. */
export const PLATFORM_LOCALES: readonly Locale[] = ['ka', 'en'] as const

/** Type guard: is a raw registry code one of the panel's known locales? */
function isKnownLocale(code: string): code is Locale {
  return (PLATFORM_LOCALES as readonly string[]).includes(code)
}

/**
 * Resolve the ordered active-locale list (pure). Narrows the site's registry
 * codes to known `Locale`s, preserving their order; degrades to default-first
 * ordering when the site set is absent/empty/unknown.
 */
export function resolveActiveLocales(
  activeLocales: readonly string[],
  defaultLocale: Locale,
): Locale[] {
  const known = activeLocales.filter(isKnownLocale)
  if (known.length > 0) return known
  // No usable site set — fall back to the default locale, then the platform set.
  return orderLocales(defaultLocale)
}

/**
 * Returns the ordered active-locale list for the current session: the site's
 * projected `activeLocales`, narrowed to known locales, with a graceful fallback
 * to default-first platform ordering.
 */
export function useActiveLocales(): Locale[] {
  const site = useSite()
  return resolveActiveLocales(site.activeLocales, site.defaultLocale)
}

/** Pure ordering helper — default first, remaining platform locales after. */
export function orderLocales(defaultLocale: Locale): Locale[] {
  const rest = PLATFORM_LOCALES.filter((l) => l !== defaultLocale)
  return [defaultLocale, ...rest]
}
