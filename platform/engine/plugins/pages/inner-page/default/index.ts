export { InnerPageShell as Shell } from './InnerPageShell'
export type { InnerPageNode }      from './InnerPageNode'

import { InnerPageSlots } from './InnerPageNode'
import type { NodeSliceMeta } from '@geostat/react/engine'

export const META: NodeSliceMeta = {
  sliceType:       'page',
  type:            'inner-page',
  variant:         'default',
  label:           { ka: 'შიდა გვერდი', en: 'Inner Page' },
  icon:            'file',
  category:        'page',
  slots:           InnerPageSlots,
  canHaveChildren: true,
  rootOnly:        true,
  version:         1,
  defaults:        { chrome: { InnerSidebar: 'default' } },
}