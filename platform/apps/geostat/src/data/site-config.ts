import type { I18nConfig, ChromeEntry } from '@geostat/react'

export const GLOBAL_CHROME: Record<string, ChromeEntry> = {
  AppBanner: 'hidden',
}

export const I18N_CONFIG: I18nConfig = {
  locales:        ['ka', 'en'],
  defaultLocale:  'ka',
  fallbackLocale: 'ka',
}