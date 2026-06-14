import './chart-renderers'  // registers built-in chart renderers

export { ChartShell as Shell } from './ChartShell'
export type { ChartNode }      from './ChartNode'

import { ChartSchema, ChartGroups } from './ChartNode'

export const META = {
  sliceType:       'panel',
  type:            'chart',
  variant:         'default',
  label:           { ka: 'დიაგრამა', en: 'Chart' },
  icon:            'bar-chart',
  category:        'data',
  schema:          ChartSchema,
  groups:          ChartGroups,
  canHaveChildren: false,
  version:         1,
} as const