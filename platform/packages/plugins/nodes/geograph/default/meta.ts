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
  // `flow` (placement capability): a geograph is flow content, admissible in a section.
  // `data-bindable`: opt into the universal DATA facet — a geograph declares a `data:
  // DataSpec` (it renders a data-driven choropleth), so it authors its pipeline in place
  // (element.facet.data over `data`), the peer of chart/table/kpi.
  // `interactive`: opt into the universal EVENTS facet — the map emits selection:change
  // gestures the `on[]`/NodeAction spine folds (element.facet.events over `on`).
  caps:            ['collapsible', 'filterable', 'view-toggle', 'nav-contributor', 'flow', 'data-bindable', 'interactive'],
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
