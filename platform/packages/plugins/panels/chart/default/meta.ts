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
  // STYLE + VISIBILITY are UNIVERSAL facets (every renderable node — no cap needed).
  // `data-bindable`: opt into the universal DATA facet (element.facet.data over `data`).
  // `interactive`: opt into the universal EVENTS facet — the chart emits point:click
  // gestures the `on[]`/NodeAction spine folds (element.facet.events over `on`).
  caps:            ['export', 'collapsible', 'filterable', 'view-toggle', 'flow', 'data-bindable', 'interactive'],
  version:         1,
}
