import type { PanelSliceMeta } from '@statdash/react/engine'
import { MapSchema, MapGroups } from './MapNode'

export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'map',
  variant:         'default',
  label:           { ka: 'ქოროპლეთ რუკა', en: 'Choropleth Map' },
  icon:            'map',
  category:        'data',
  schema:          MapSchema,
  groups:          MapGroups,
  canHaveChildren: false,
  caps:            ['collapsible', 'filterable', 'view-toggle'],
  version:         1,
}
