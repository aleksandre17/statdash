import type { I18nProvider } from 'react-admin'

// Minimal i18nProvider — Georgian default.
// Phase 2 swaps this for polyglotI18nProvider (ra-i18n-polyglot) with
// real ka/en message catalogs; the identity translate is a passthrough seam.
export const i18nProvider: I18nProvider = {
  translate: (key: string) => key,
  changeLocale: async () => {},
  getLocale: () => 'ka',
}
