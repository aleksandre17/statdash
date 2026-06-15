import type { PageSliceMeta } from '@geostat/react/engine'
import { TabPageSlots } from './TabPageNode'

export const META: PageSliceMeta = {
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
