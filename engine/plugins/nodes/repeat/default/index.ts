export { RepeatShell as Shell } from './RepeatShell'
export type { RepeatNode }      from './RepeatNode'

import { RepeatSchema, RepeatDefaults, RepeatSlots } from './RepeatNode'

export const META = {
  sliceType:       'node',
  type:            'repeat',
  variant:         'default',
  label:           { ka: 'განმეორება', en: 'Repeat' },
  category:        'layout',
  schema:          RepeatSchema,
  defaults:        RepeatDefaults,
  slots:           RepeatSlots,
  canHaveChildren: true,
  version:         1,
} as const