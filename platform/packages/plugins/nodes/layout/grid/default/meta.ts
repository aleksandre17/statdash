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
  // `nav-transparent` (descend-for-nav): sections nested in a 12-col grid still
  // surface in the page nav — same container contract as columns/row.
  caps:            ['nav-transparent'],
  version:         1,
}
