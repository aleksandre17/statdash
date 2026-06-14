export { ModeBarShell    as Shell   } from './ModeBarShell'
export { ModeBarSkeleton as Skeleton } from './ModeBarSkeleton'
export type { ModeBarNode }            from './ModeBarNode'

import { ModeBarSchema } from './ModeBarNode'

export const META = {
  sliceType:       'node',
  type:            'mode-bar',
  variant:         'default',
  label:           { ka: 'Mode Tab Bar', en: 'Mode Tab Bar' },
  icon:            'tabs',
  category:        'layout',
  schema:          ModeBarSchema,
  canHaveChildren: false,
  singleton:       true,
  version:         1,
} as const