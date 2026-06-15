import type { NodeSliceMeta } from '@geostat/react/engine'
import { StackSchema, StackDefaults, StackSlots, StackGroups } from './StackNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'stack',
  variant:         'default',
  label:           { ka: 'სტეკი', en: 'Stack' },
  icon:            'layout-stack',
  category:        'layout',
  schema:          StackSchema,
  defaults:        StackDefaults,
  slots:           StackSlots,
  groups:          StackGroups,
  canHaveChildren: true,
  version:         1,
}
