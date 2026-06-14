export { TabPageShell as Shell } from './TabPageShell'
export type { TabPageNode }      from './TabPageNode'
export type { TabsNode, TabNode } from './TabsNode'

import { TabPageSlots }  from './TabPageNode'
import type { NodeSliceMeta } from '@geostat/react/engine'

export const META: NodeSliceMeta = {
  sliceType:       'page',
  type:            'tab-page',
  variant:         'default',
  label:           { ka: 'Tab-გვერდი', en: 'Tab Page' },
  icon:            'layout-tabs',
  category:        'page',
  slots:           TabPageSlots,
  canHaveChildren: true,
  rootOnly:        true,
  version:         1,
}