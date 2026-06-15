import type { NodeSliceMeta } from '@geostat/react/engine'
import { ColumnsSchema, ColumnsDefaults, ColumnsSlots, ColumnsGroups } from './ColumnsNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'columns',
  variant:         'default',
  label:           { ka: 'სვეტები', en: 'Columns' },
  icon:            'layout-columns',
  category:        'layout',
  schema:          ColumnsSchema,
  defaults:        ColumnsDefaults,
  slots:           ColumnsSlots,
  groups:          ColumnsGroups,
  canHaveChildren: true,
  version:         1,
}
