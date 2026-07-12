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
  // `flow` (placement capability): a kpi-strip is flow content, admissible in a section.
  // `styleable`: opt into the universal STYLE facet (element.style over view.styles).
  // `data-bindable`: opt into the universal DATA facet (element.facet.data over `data`).
  // `interactive`: opt into the universal EVENTS facet — a kpi tile emits point:click
  // gestures the `on[]`/NodeAction spine folds (element.facet.events over `on`).
  caps:            ['filterable', 'flow', 'styleable', 'data-bindable', 'interactive'],
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
