import type { NodeSliceMeta } from '@statdash/react/engine'
import { SpacerSchema, SpacerDefaults, SpacerGroups } from './SpacerNode'

export const META: NodeSliceMeta = {
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
  caps:            [],
  version:         1,
}
