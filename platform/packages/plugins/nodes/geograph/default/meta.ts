import type { NodeSliceMeta } from '@statdash/react/engine'
import { GeographSchema, GeographSlots, GeographGroups } from './GeographNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'geograph',
  variant:         'default',
  label:           { ka: 'გეო-რუკა', en: 'Geo Map' },
  category:        'data',
  schema:          GeographSchema,
  slots:           GeographSlots,
  groups:          GeographGroups,
  canHaveChildren: true,
  caps:            ['collapsible', 'filterable', 'view-toggle', 'nav-contributor'],
  version:         1,
  i18n: {
    ka: {
      'view-map':    'რუქა',
      'view-table':  'ცხრილი',
      'view-toggle': 'ხედის გადართვა',
    },
    en: {
      'view-map':    'Map',
      'view-table':  'Table',
      'view-toggle': 'Toggle view',
    },
  },
}
