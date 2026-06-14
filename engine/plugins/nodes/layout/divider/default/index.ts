export { DividerShell as Shell } from './DividerShell'
export type { DividerNode }      from './DividerNode'

import { DividerSchema, DividerDefaults, DividerGroups } from './DividerNode'

export const META = {
  sliceType:       'node',
  type:            'divider',
  variant:         'default',
  label:           { ka: 'გამყოფი', en: 'Divider' },
  icon:            'minus',
  category:        'layout',
  schema:          DividerSchema,
  defaults:        DividerDefaults,
  groups:          DividerGroups,
  canHaveChildren: false,
  version:         1,
} as const