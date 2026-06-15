import type { NodeSliceMeta } from '@geostat/react/engine'
import { DividerSchema, DividerDefaults, DividerGroups } from './DividerNode'

export const META: NodeSliceMeta = {
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
}
