export { ColumnsShell as Shell } from './ColumnsShell'
export type { ColumnsNode }      from './ColumnsNode'

import { ColumnsSchema, ColumnsDefaults, ColumnsSlots, ColumnsGroups } from './ColumnsNode'

export const META = {
  sliceType:       'node',
  type:            'columns',
  variant:         'default',
  label:           { ka: 'სვეტები', en: 'Columns' },
  icon:            'layout-columns',
  category:        'layout',
  schema:          ColumnsSchema,
  defaults:        ColumnsDefaults,
  slots:           ColumnsSlots,
  groups:          ColumnsGroups,
  canHaveChildren: true,
  version:         1,
} as const