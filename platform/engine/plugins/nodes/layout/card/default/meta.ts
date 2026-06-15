import type { NodeSliceMeta } from '@geostat/react/engine'
import { CardSlots } from './CardNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'card',
  variant:         'default',
  label:           { ka: 'კარტა', en: 'Card' },
  icon:            'layout-card',
  category:        'layout',
  slots:           CardSlots,
  canHaveChildren: true,
  version:         1,
}
