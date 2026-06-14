export { KpiStripShell as Shell } from './KpiStripShell'
export { Skeleton }               from './KpiStripSkeleton'
export type { KpiStripNode }      from './KpiStripNode'

import { KpiStripSchema, KpiStripGroups } from './KpiStripNode'

export const META = {
  sliceType:       'panel',
  type:            'kpi-strip',
  variant:         'default',
  label:           { ka: 'KPI სტრიპი', en: 'KPI Strip' },
  icon:            'trending-up',
  category:        'data',
  schema:          KpiStripSchema,
  groups:          KpiStripGroups,
  canHaveChildren: false,
  version:         1,
} as const