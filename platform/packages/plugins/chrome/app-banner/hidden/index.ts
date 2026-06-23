import type { ChromeSliceMeta } from '@statdash/react/engine'
import { NullChromeSlot }       from '@statdash/react/engine'

export const Shell = NullChromeSlot

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'AppBanner',
  key:           'hidden',
  label:         { ka: 'ბანერი გამორთულია', en: 'Banner Hidden' },
  icon:          'eye-off',
  version:       1,
  defaultRegion: 'top',
  defaultOrder:  0,
}