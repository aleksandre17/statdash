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
}
