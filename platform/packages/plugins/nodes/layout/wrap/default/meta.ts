import type { NodeSliceMeta } from '@statdash/react/engine'
import { WrapSchema, WrapSlots } from './WrapNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'wrap',
  variant:         'default',
  label:           { ka: 'სტილის განაწილება', en: 'Style Wrap' },
  icon:            'layers',
  category:        'layout',
  schema:          WrapSchema,
  slots:           WrapSlots,
  transparent:     true,
  canHaveChildren: true,
  caps:            [],
  version:         1,
}
