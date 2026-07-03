// ── localeDirection — locale → text-direction lookup (ltr/rtl) ────────────────
//
//  AR-37 P0 (DESIGN-i18n-full-sync-and-integrity-badges.md §2.1): the document-
//  binding seam (LocaleGuard) needs a text direction per active locale. A tiny,
//  agnostic registry — NOT a per-locale conditional scattered across shells
//  (Law 1) — so a future RTL locale (ar/he/fa/ur) "just works" by resolving here,
//  no shell touched (Law 8, Postel's Law: liberal in what locale tags we accept).
//
//  Every locale @statdash ships today (ka, en) is ltr; the table exists so the
//  seam is ready BEFORE it is needed, not so it is used today.
//

export type Direction = 'ltr' | 'rtl'

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur'])

/**
 * localeDirection — resolve a BCP-47 locale tag (e.g. 'ka', 'en', 'ar-EG') to its
 * writing direction. Matches on the base language subtag (case-insensitive);
 * an unrecognized locale defaults to 'ltr' (the common case) — never throws.
 */
export function localeDirection(locale: string): Direction {
  const base = locale.split('-')[0]?.toLowerCase() ?? ''
  return RTL_LOCALES.has(base) ? 'rtl' : 'ltr'
}
