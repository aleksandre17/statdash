import type { NodeSliceMeta } from '@statdash/react/engine'
import { RowSchema, RowDefaults, RowSlots } from './RowNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'row',
  variant:         'default',
  label:           { ka: 'მწკრივი', en: 'Row Layout' },
  category:        'layout',
  schema:          RowSchema,
  defaults:        RowDefaults,
  slots:           RowSlots,
  canHaveChildren: true,
  caps:            [],
  version:         1,
}
