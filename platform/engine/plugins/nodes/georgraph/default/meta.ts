import type { NodeSliceMeta } from '@geostat/react/engine'
import { GeorgraphSchema, GeorgraphSlots, GeorgraphGroups } from './GeorgraphNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'georgraph',
  variant:         'default',
  label:           { ka: 'გეო-რუკა', en: 'Geo Map' },
  category:        'data',
  schema:          GeorgraphSchema,
  slots:           GeorgraphSlots,
  groups:          GeorgraphGroups,
  canHaveChildren: true,
  version:         1,
}
