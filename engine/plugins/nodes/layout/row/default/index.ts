export { RowShell as Shell } from './RowShell'
export type { RowNode }      from './RowNode'

import { RowSchema, RowDefaults, RowSlots } from './RowNode'

export const META = {
  sliceType:       'node',
  type:            'row',
  variant:         'default',
  label:           { ka: 'მწკრივი', en: 'Row Layout' },
  category:        'layout',
  schema:          RowSchema,
  defaults:        RowDefaults,
  slots:           RowSlots,
  canHaveChildren: true,
  version:         1,
} as const