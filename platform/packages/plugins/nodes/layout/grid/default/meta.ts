import type { NodeSliceMeta } from '@statdash/react/engine'
import { GridSchema, GridDefaults, GridSlots, GridGroups } from './GridNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'grid',
  variant:         'default',
  label:           { ka: 'გრიდი', en: 'Grid' },
  icon:            'layout-grid',
  category:        'layout',
  schema:          GridSchema,
  defaults:        GridDefaults,
  slots:           GridSlots,
  groups:          GridGroups,
  canHaveChildren: true,
  caps:            [],
  version:         1,
}
