export { GeorgraphShell as Shell } from './GeorgraphShell'
export type { GeorgraphNode }      from './GeorgraphNode'

import { GeorgraphSchema, GeorgraphSlots, GeorgraphGroups } from './GeorgraphNode'

export const META = {
  sliceType:       'node',
  type:            'georgraph',
  variant:         'default',
  label:           { ka: 'გეო-რუკა', en: 'Geo Map' },
  category:        'data',
  schema:          GeorgraphSchema,
  slots:           GeorgraphSlots,
  groups:          GeorgraphGroups,
  canHaveChildren: true,
  version:         1,
} as const