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
  // STYLE + VISIBILITY are UNIVERSAL facets (every renderable node — no cap needed).
  // `data-bindable`: opt into the universal DATA facet (element.facet.data over `data`).
  // `interactive`: opt into the universal EVENTS facet — a kpi tile emits point:click
  // gestures the `on[]`/NodeAction spine folds (element.facet.events over `on`).
  caps:            ['filterable', 'flow', 'data-bindable', 'interactive'],
  version:         1,
  i18n: {
    ka: {
      'trend-up': 'მზარდი:', 'trend-down': 'კლებადი:', 'trend-flat': 'სტაბილური:',
      'methodology': 'მეთოდოლოგია',
      // Honest UNBOUND state (Canon C2) — never a fake 0; an affordance to bind (J4).
      'unbound-title': 'აუბმელი მაჩვენებელი',
      'unbound-hint':  'აირჩიე მეტრიკა',
    },
    en: {
      'trend-up': 'Up:', 'trend-down': 'Down:', 'trend-flat': 'Flat:',
      'methodology': 'Methodology',
      'unbound-title': 'Unbound metric',
      'unbound-hint':  'Choose a metric',
    },
  },
}
