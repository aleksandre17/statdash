import type { NodeSliceMeta, PropSchema, PropertyGroup } from '@statdash/react/engine'

// ── FilterBarSchema — the inspector-editable props of a filter-bar node ──
//
//  A filter-bar is a placeholder that renders the bars declared in the page's
//  filterSchema (Grafana: the variable-controls panel is separate from the
//  variable list). Its only authored prop is `barIds` — which named bars to
//  render. Absent ⇒ render all bars. This is an array of bar-id strings.
//
export const FilterBarSchema: PropSchema = [
  {
    field: 'barIds',
    type:  'array',
    label: { ka: 'საჩვენებელი ბარები', en: 'Bars to show' },
  },
]

export const FilterBarGroups: PropertyGroup[] = [
  { label: { ka: 'ფილტრები', en: 'Filters' }, fields: ['barIds'] },
]

export const META: NodeSliceMeta = {
  sliceType: 'node',
  type:      'filter-bar',
  variant:   'default',
  label:     { ka: 'ფილტრების პანელი', en: 'Filter Bar' },
  icon:      'sliders',
  category:  'layout',
  schema:    FilterBarSchema,
  groups:    FilterBarGroups,
  caps:      [],
  version:   1,
}
