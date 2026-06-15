import type { NodeBase, NodeDef, SlotDef, PropertyGroup, PropSchema } from '@geostat/react/engine'
import type { ResponsiveVal }                             from '@geostat/styles'

export interface ColumnsNode extends NodeBase {
  type:     'columns'
  count?:   ResponsiveVal<number>
  gap?:     ResponsiveVal<string>
  children: NodeDef[]
}

export const ColumnsSchema: PropSchema = [
  { field: 'count', type: 'number', label: 'სვეტები', default: 2 },
  { field: 'gap',   type: 'string', label: 'Gap',     default: 'var(--spacing-md)' },
]

export const ColumnsDefaults: Partial<ColumnsNode> = { count: 2 }

export const ColumnsSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'სვეტები', en: 'Columns' },
    multi: true,
  },
}

export const ColumnsGroups: PropertyGroup[] = [
  { label: { ka: 'განლაგება', en: 'Layout' }, fields: ['count', 'gap'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'columns': ColumnsNode }
}