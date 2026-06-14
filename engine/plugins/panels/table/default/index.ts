export { TableShell as Shell } from './TableShell'
export type { TableNode }      from './TableNode'

import { TableSchema, TableGroups } from './TableNode'

export const META = {
  sliceType:       'panel',
  type:            'table',
  variant:         'default',
  label:           { ka: 'ცხრილი', en: 'Table' },
  icon:            'table',
  category:        'data',
  schema:          TableSchema,
  groups:          TableGroups,
  canHaveChildren: false,
  version:         1,
} as const