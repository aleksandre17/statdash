import type { PanelSliceMeta } from '@statdash/react/engine'
import { GaugeSchema, GaugeGroups } from './GaugeNode'

export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'gauge',
  variant:         'default',
  label:           { ka: 'გეიჯი', en: 'Gauge' },
  icon:            'gauge',
  category:        'data',
  schema:          GaugeSchema,
  groups:          GaugeGroups,
  canHaveChildren: false,
  caps:            ['filterable'],
  version:         1,
}
