import type { PanelSliceMeta } from '@statdash/react/engine'
import { ChartSchema, ChartGroups } from './ChartNode'

export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'chart',
  variant:         'default',
  label:           { ka: 'დიაგრამა', en: 'Chart' },
  icon:            'bar-chart',
  category:        'data',
  schema:          ChartSchema,
  groups:          ChartGroups,
  canHaveChildren: false,
  caps:            ['export', 'collapsible', 'filterable', 'view-toggle'],
  version:         1,
}
