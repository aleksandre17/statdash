import type { ChromeSliceMeta } from '@statdash/react/engine'
export { ThemeSwitcherShell as Shell } from './ThemeSwitcherShell'

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'ThemeSwitcher',
  key:           'default',
  label:         { ka: 'თემის გადამრთველი', en: 'Theme Switcher' },
  icon:          'sun-moon',
  version:       1,
  defaultRegion: 'inline',
  defaultOrder:  0,
  i18n: {
    ka: { 'group-label': 'თემა', 'light': 'ღია თემა', 'dark': 'მუქი თემა' },
    en: { 'group-label': 'Theme', 'light': 'Light theme', 'dark': 'Dark theme' },
  },
}
