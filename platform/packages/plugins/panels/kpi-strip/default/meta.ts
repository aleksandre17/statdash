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
      // Honest INTERPRET-DERIVED states (AR-52 · Law 11) — never a fabricated 0.
      // no-data: the spec IS bound but the store has no observation at the coordinate.
      'no-data-title': 'მონაცემი არ არის',
      'no-data-hint':  'ამ კოორდინატისთვის დაკვირვება არ მოიძებნა',
      // masked: SDMX OBS_STATUS 'c' — confidential, the value must NOT be published.
      'masked-title':  'კონფიდენციალური',
      'masked-hint':   'მნიშვნელობა დაფარულია',
    },
    en: {
      'trend-up': 'Up:', 'trend-down': 'Down:', 'trend-flat': 'Flat:',
      'methodology': 'Methodology',
      'unbound-title': 'Unbound metric',
      'unbound-hint':  'Choose a metric',
      'no-data-title': 'No data',
      'no-data-hint':  'No observation for this coordinate',
      'masked-title':  'Confidential',
      'masked-hint':   'Value withheld',
    },
  },
}
