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
  // `styleable`: opt into the universal STYLE facet (element.style over view.styles).
  // `data-bindable`: opt into the universal DATA facet (element.facet.data over `data`).
  caps:            ['export', 'collapsible', 'filterable', 'flow', 'styleable', 'data-bindable'],
  version:         1,
}
