// ── ICU-lite message formatter [N22] ──────────────────────────────────
//
//  Supports:
//    {variable}                       — simple substitution
//    {count, plural, one{…} other{…}} — CLDR plural rules (one/other)
//
//  For full ICU compliance (select, ordinal, date/time format, nested),
//  use @formatjs/intl-messageformat. This covers the 95% case with zero
//  external dependencies.
//
//  Usage:
//    formatMessage('{name} ჩამოიტვირთა', { name: 'მშპ' }, 'ka')
//    → 'მშპ ჩამოიტვირთა'
//
//    formatMessage('{count, plural, one{1 ჩანაწერი} other{# ჩანაწერი}}', { count: 5 }, 'ka')
//    → '5 ჩანაწერი'
//

import type { LocaleString }   from './types'
import { resolveLocaleString } from './types'

/**
 * Resolve a LocaleString template then substitute `{variable}` placeholders.
 * Supports CLDR `{count, plural, one{…} other{…}}` — `#` inside the branch
 * is replaced by the numeric count.
 *
 * @param tpl      - ICU-compatible LocaleString template
 * @param vars     - substitution values
 * @param locale   - BCP 47 locale tag (e.g. 'ka', 'en')
 * @param fallback - fallback locale when tpl has no match for locale
 */
export function formatMessage(
  tpl:      LocaleString,
  vars:     Record<string, unknown>,
  locale:   string,
  fallback  = 'en',
): string {
  const template = resolveLocaleString(tpl, locale, fallback)

  // Pass 1 — plural rules: {count, plural, one{…} other{…}}
  const withPlurals = template.replace(
    /\{(\w+),\s*plural,\s*one\{([^}]*)\}\s*other\{([^}]*)\}\}/g,
    (_match, key: string, one: string, other: string) => {
      const count = Number(vars[key] ?? 0)
      const branch = count === 1 ? one : other
      // Replace `#` inside the chosen branch with the numeric count
      return branch.replace(/#/g, String(count))
    },
  )

  // Pass 2 — simple {variable} substitution
  return withPlurals.replace(
    /\{(\w+)\}/g,
    (_match, key: string) => {
      const val = vars[key]
      return val === undefined || val === null ? `{${key}}` : String(val)
    },
  )
}
