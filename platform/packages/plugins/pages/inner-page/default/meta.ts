import type { PageSliceMeta } from '@statdash/react/engine'
import { InnerPageSlots } from './InnerPageNode'

export const META: PageSliceMeta = {
  sliceType:       'page',
  type:            'inner-page',
  variant:         'default',
  label:           { ka: 'შიდა გვერდი', en: 'Inner Page' },
  icon:            'file',
  category:        'page',
  slots:           InnerPageSlots,
  canHaveChildren: true,
  rootOnly:        true,
  caps:            [],
  version:         1,
  defaults:        { chrome: { InnerSidebar: 'default' } },
}
