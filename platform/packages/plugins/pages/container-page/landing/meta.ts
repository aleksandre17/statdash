import type { PageSliceMeta } from '@statdash/react/engine'

export const META: PageSliceMeta = {
  sliceType: 'page',
  type:      'container-page',
  variant:   'landing',
  label:     { ka: 'Landing გვერდი', en: 'Landing Page' },
  category:  'page',
  rootOnly:  true,
  caps:      [],
  version:   1,
  defaults:  { frame: 'landing', chrome: { AppHeader: 'transparent', InnerSidebar: 'hidden' } },
}
