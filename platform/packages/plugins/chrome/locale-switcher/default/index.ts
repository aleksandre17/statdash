import type { ChromeSliceMeta } from '@statdash/react/engine'
export { LocaleSwitcherShell as Shell } from './LocaleSwitcherShell'

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'LocaleSwitcher',
  key:           'default',
  label:         { ka: 'ენის გადამრთველი', en: 'Locale Switcher' },
  icon:          'languages',
  version:       1,
  defaultRegion: 'inline',
  defaultOrder:  0,
}