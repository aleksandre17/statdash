import type { ChromeSliceMeta } from '@geostat/react/engine'
import { NullChromeSlot }       from '@geostat/react/engine'

export const Shell = NullChromeSlot

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'InnerSidebar',
  key:           'hidden',
  label:         { ka: 'გვერდითი პანელი გამორთულია', en: 'Sidebar Hidden' },
  icon:          'eye-off',
  version:       1,
  defaultRegion: 'inline',
  defaultOrder:  0,
}