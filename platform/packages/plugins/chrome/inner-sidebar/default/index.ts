import type { ChromeSliceMeta } from '@statdash/react/engine'
export { InnerSidebarShell as Shell } from './InnerSidebarShell'

export const META: ChromeSliceMeta = {
  sliceType:     'chrome',
  slot:          'InnerSidebar',
  key:           'default',
  label:         { ka: 'ნავიგაციის პანელი', en: 'Navigation Sidebar' },
  icon:          'sidebar',
  version:       1,
  defaultRegion: 'inline',
  defaultOrder:  0,
}