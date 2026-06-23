// ── useActiveLocales — the active locale list for LocaleString authoring ────
//
//  Single source of truth for "which locales must an author fill in?".
//  V13/V14 gold enforces LocaleString COMPLETENESS — a localized field must
//  carry every active locale, not just the default. The Inspector's LocaleField
//  renders one input per active locale, so it needs this list.
//
//  Source of truth (in priority order, Postel's Law — derive, never hardcode):
//    1. The Constructor session's site.defaultLocale is always included first
//       (it is the guaranteed-present locale).
//    2. The platform's known locale set (PLATFORM_LOCALES) supplies the rest.
//
//  SEAM (flagged): the authoritative active-locale list is `config.locale`
//  (the bootstrap locale registry), not a hardcoded union. That registry is
//  not yet surfaced to apps/panel. PLATFORM_LOCALES is the interim default;
//  when the bootstrap exposes the locale list to the panel, replace the
//  constant with that read — this hook is the one place to change.
//
import type { Locale } from '../types/constructor'
import { useSite } from '../store/constructor.store'

/** Interim platform locale set — see SEAM note above (config.locale registry). */
export const PLATFORM_LOCALES: readonly Locale[] = ['ka', 'en'] as const

/**
 * Returns the ordered active-locale list for the current session:
 * the site default first, then every other platform locale.
 */
export function useActiveLocales(): Locale[] {
  const site = useSite()
  return orderLocales(site.defaultLocale)
}

/** Pure ordering helper — default first, remaining platform locales after. */
export function orderLocales(defaultLocale: Locale): Locale[] {
  const rest = PLATFORM_LOCALES.filter((l) => l !== defaultLocale)
  return [defaultLocale, ...rest]
}
