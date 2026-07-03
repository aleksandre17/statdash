import type { PanelSliceMeta } from '@statdash/react/engine'
import { KpiStripSchema, KpiStripGroups } from './KpiStripNode'

export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'kpi-strip',
  variant:         'default',
  label:           { ka: 'KPI სტრიპი', en: 'KPI Strip' },
  icon:            'trending-up',
  category:        'data',
  schema:          KpiStripSchema,
  groups:          KpiStripGroups,
  canHaveChildren: false,
  caps:            ['filterable'],
  version:         1,
  i18n: {
    ka: {
      'trend-up': 'მზარდი:', 'trend-down': 'კლებადი:', 'trend-flat': 'სტაბილური:',
      'methodology': 'მეთოდოლოგია',
    },
    en: {
      'trend-up': 'Up:', 'trend-down': 'Down:', 'trend-flat': 'Flat:',
      'methodology': 'Methodology',
    },
  },
}
