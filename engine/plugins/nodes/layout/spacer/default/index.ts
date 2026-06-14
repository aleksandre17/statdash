export { SpacerShell as Shell } from './SpacerShell'
export type { SpacerNode }      from './SpacerNode'

import { SpacerSchema, SpacerDefaults, SpacerGroups } from './SpacerNode'

export const META = {
  sliceType:       'node',
  type:            'spacer',
  variant:         'default',
  label:           { ka: 'სივრცე', en: 'Spacer' },
  icon:            'move-vertical',
  category:        'layout',
  schema:          SpacerSchema,
  defaults:        SpacerDefaults,
  groups:          SpacerGroups,
  canHaveChildren: false,
  version:         1,
} as const