import type { NodeBase, NodeDef, SlotDef, PropertyGroup } from '@geostat/react/engine'
import type { ResponsiveVal }                             from '@geostat/styles'

export interface ColumnsNode extends NodeBase {
  type:     'columns'
  count?:   ResponsiveVal<number>
  gap?:     ResponsiveVal<string>
  children: NodeDef[]
}

export const ColumnsSchema = {
  type: 'object',
  properties: {
    count: { type: 'number', title: 'სვეტები', default: 2 },
    gap:   { type: 'string', title: 'Gap',     default: 'var(--spacing-md)' },
  },
} as const

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