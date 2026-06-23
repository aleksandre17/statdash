import type { NodeSliceMeta } from '@statdash/react/engine'
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
  caps:            [],
  version:         1,
}
