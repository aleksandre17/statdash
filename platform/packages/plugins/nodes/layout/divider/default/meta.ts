import type { NodeSliceMeta } from '@statdash/react/engine'
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
  // `flow` — placement capability: a divider is flow content (admissible in a section).
  caps:            ['flow'],
  version:         1,
}
