import type { NodeBase, NodeDef, SlotDef, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { ResponsiveVal, LayoutAlign }                 from '@statdash/styles'

export interface GridNode extends NodeBase {
  type:     'grid'
  columns?: ResponsiveVal<number>
  gap?:     ResponsiveVal<string>
  /** Cross-axis alignment of the grid cells. `stretch` (default) = equal-height. */
  align?:   ResponsiveVal<LayoutAlign>
  children: NodeDef[]
}

export const GridSchema: PropSchema = [
  { field: 'columns', type: 'number', label: { ka: 'სვეტები',  en: 'Columns' }, default: 12 },
  { field: 'gap',     type: 'string', label: { ka: 'დაშორება', en: 'Gap' }, default: 'var(--spacing-md)' },
  {
    field:   'align',
    type:    'string',
    label:   { ka: 'გასწორება', en: 'Align' },
    default: 'stretch',
    options: [
      { value: 'stretch', label: { ka: 'გაწელვა',   en: 'Stretch' } },
      { value: 'start',   label: { ka: 'დასაწყისი', en: 'Start' } },
      { value: 'center',  label: { ka: 'ცენტრი',    en: 'Center' } },
      { value: 'end',     label: { ka: 'დასასრული', en: 'End' } },
    ],
  },
]

export const GridDefaults: Partial<GridNode> = {
  columns: 12,
  gap:     'var(--spacing-md)',
}

export const GridSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'ელემენტები', en: 'Items' },
    multi: true,
  },
}

export const GridGroups: PropertyGroup[] = [
  { label: { ka: 'განლაგება', en: 'Layout' }, fields: ['columns', 'gap', 'align'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'grid': GridNode }
}