import type { ChromeSliceMeta } from '@statdash/react/engine'
import { NullChromeSlot }       from '@statdash/react/engine'

export const Shell = NullChromeSlot

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'AppHeader',
  key:           'hidden',
  label:         { ka: 'სათაური გამორთულია', en: 'Header Hidden' },
  icon:          'eye-off',
  version:       1,
  defaultRegion: 'top',
  defaultOrder:  10,
}