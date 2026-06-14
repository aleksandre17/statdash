export { StackShell as Shell } from './StackShell'
export type { StackNode }      from './StackNode'

import { StackSchema, StackDefaults, StackSlots, StackGroups } from './StackNode'

export const META = {
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
} as const
