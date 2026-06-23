import type { NodeSliceMeta } from '@statdash/react/engine'
import { RepeatSchema, RepeatDefaults, RepeatSlots } from './RepeatNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'repeat',
  variant:         'default',
  label:           { ka: 'განმეორება', en: 'Repeat' },
  category:        'layout',
  schema:          RepeatSchema,
  defaults:        RepeatDefaults,
  slots:           RepeatSlots,
  canHaveChildren: true,
  caps:            ['repeat', 'filterable'],
  version:         1,
}
