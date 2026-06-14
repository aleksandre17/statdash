import type { ChromeSliceMeta } from '@geostat/react/engine'
export { AppFooterShell as Shell } from './AppFooterShell'

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'AppFooter',
  key:           'default',
  label:         { ka: 'სტანდარტული ქვედა ზოლი', en: 'Standard Footer' },
  icon:          'layout-bottom',
  version:       1,
  defaultRegion: 'bottom',
  defaultOrder:  0,
}