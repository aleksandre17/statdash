// ── localeString — pure helpers over the engine LocaleString shape ──────────
//
//  LocaleString = string | Record<locale, string>. Authoring is always done as
//  the Record form (one input per active locale) so V13/V14 gold completeness
//  holds. These helpers read/normalize without leaking the shape into controls.
//
import type { Locale } from '../types/constructor'

export type LocaleRecord = Record<string, string>
export type LocaleStringValue = string | LocaleRecord | undefined

/** Read the string for one locale, tolerating the plain-string legacy form. */
export function readLocale(value: LocaleStringValue, locale: Locale): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return value[locale] ?? ''
}

/**
 * Produce a COMPLETE LocaleString record: every active locale present (empty
 * string for unfilled ones), with `locale` set to `next`. Authoring the full
 * record — not a partial — is what satisfies the gold completeness rule.
 *
 * A plain-string legacy value is first lifted to a record seeded across all
 * active locales (Postel's Law: liberal in what we accept).
 */
export function writeLocale(
  value: LocaleStringValue,
  locale: Locale,
  next: string,
  activeLocales: Locale[],
): LocaleRecord {
  const base: LocaleRecord = {}
  for (const l of activeLocales) base[l] = ''

  if (typeof value === 'string') {
    // Legacy plain string seeded the default; keep it under every locale until
    // the author overrides per-locale (avoids silently dropping existing text).
    for (const l of activeLocales) base[l] = value
  } else if (value && typeof value === 'object') {
    for (const l of activeLocales) base[l] = value[l] ?? ''
  }

  base[locale] = next
  return base
}
