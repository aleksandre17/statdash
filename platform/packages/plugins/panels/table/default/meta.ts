import type { PanelSliceMeta } from '@statdash/react/engine'
import { TableSchema, TableGroups } from './TableNode'

export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'table',
  variant:         'default',
  label:           { ka: 'ცხრილი', en: 'Table' },
  icon:            'table',
  category:        'data',
  schema:          TableSchema,
  groups:          TableGroups,
  canHaveChildren: false,
  // `flow` (placement capability): a table is flow content, admissible in a section.
  // STYLE + VISIBILITY are UNIVERSAL facets (every renderable node — no cap needed).
  // `data-bindable`: opt into the universal DATA facet (element.facet.data over `data`).
  // `interactive`: opt into the universal EVENTS facet — the table emits row:click/
  // row:hover gestures the `on[]`/NodeAction spine folds (element.facet.events over `on`).
  caps:            ['export', 'collapsible', 'filterable', 'flow', 'data-bindable', 'interactive'],
  version:         1,
}
