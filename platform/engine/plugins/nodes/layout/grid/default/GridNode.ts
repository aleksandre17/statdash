import type { NodeBase, NodeDef, SlotDef, PropertyGroup } from '@geostat/react/engine'
import type { ResponsiveVal }                             from '@geostat/styles'

export interface GridNode extends NodeBase {
  type:     'grid'
  columns?: ResponsiveVal<number>
  gap?:     ResponsiveVal<string>
  children: NodeDef[]
}

export const GridSchema = {
  type: 'object',
  properties: {
    columns: { type: 'number', title: 'სვეტები', default: 12 },
    gap:     { type: 'string', title: 'Gap', default: 'var(--spacing-md)' },
  },
} as const

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
  { label: { ka: 'განლაგება', en: 'Layout' }, fields: ['columns', 'gap'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'grid': GridNode }
}