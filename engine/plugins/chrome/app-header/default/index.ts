import type { ChromeSliceMeta } from '@geostat/react/engine'
export { AppHeaderShell as Shell } from './AppHeaderShell'

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'AppHeader',
  key:           'default',
  label:         { ka: 'სრული სათაური', en: 'Full Header' },
  icon:          'layout-template',
  version:       1,
  defaultRegion: 'top',
  defaultOrder:  10,
}