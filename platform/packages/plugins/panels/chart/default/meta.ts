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
  // `flow` (placement capability): a chart is flow content, admissible in a section.
  caps:            ['export', 'collapsible', 'filterable', 'view-toggle', 'flow'],
  version:         1,
}
