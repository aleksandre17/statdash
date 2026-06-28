import type { NodeBase, NodeDef, SlotDef, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { ResponsiveVal }                             from '@statdash/styles'

export interface GridNode extends NodeBase {
  type:     'grid'
  columns?: ResponsiveVal<number>
  gap?:     ResponsiveVal<string>
  children: NodeDef[]
}

export const GridSchema: PropSchema = [
  { field: 'columns', type: 'number', label: { ka: 'სვეტები',  en: 'Columns' }, default: 12 },
  { field: 'gap',     type: 'string', label: { ka: 'დაშორება', en: 'Gap' }, default: 'var(--spacing-md)' },
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
  { label: { ka: 'განლაგება', en: 'Layout' }, fields: ['columns', 'gap'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'grid': GridNode }
}