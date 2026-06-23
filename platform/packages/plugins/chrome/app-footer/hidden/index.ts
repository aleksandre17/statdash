import type { ChromeSliceMeta } from '@statdash/react/engine'
import { NullChromeSlot }       from '@statdash/react/engine'

export const Shell = NullChromeSlot

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'AppFooter',
  key:           'hidden',
  label:         { ka: 'ქვედა ზოლი გამორთულია', en: 'Footer Hidden' },
  icon:          'eye-off',
  version:       1,
  defaultRegion: 'bottom',
  defaultOrder:  0,
}