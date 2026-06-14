import type { ChromeSliceMeta } from '@geostat/react/engine'
export { AppHeaderTransparentShell as Shell } from './AppHeaderTransparentShell'

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'AppHeader',
  key:           'transparent',
  label:         { ka: 'გამჭვირვალე სათაური', en: 'Transparent Header' },
  icon:          'layout-template',
  version:       1,
  defaultRegion: 'top',
  defaultOrder:  10,
}