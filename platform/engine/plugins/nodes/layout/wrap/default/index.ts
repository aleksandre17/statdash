export { WrapShell as Shell } from './WrapShell'
export type { WrapNode }      from './WrapNode'

import { WrapSchema, WrapSlots } from './WrapNode'

export const META = {
  sliceType:       'node',
  type:            'wrap',
  variant:         'default',
  label:           { ka: 'სტილის განაწილება', en: 'Style Wrap' },
  icon:            'layers',
  category:        'layout',
  schema:          WrapSchema,
  slots:           WrapSlots,
  transparent:     true,
  canHaveChildren: true,
  version:         1,
} as const