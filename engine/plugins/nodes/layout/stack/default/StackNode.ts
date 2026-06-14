import type { NodeBase, NodeDef, SlotDef, PropertyGroup } from '@geostat/react/engine'
import type { ResponsiveVal }                             from '@geostat/styles'

export interface StackNode extends NodeBase {
  type:       'stack'
  direction?: 'row' | 'column'
  gap?:       ResponsiveVal<string>
  wrap?:      boolean
  children:   NodeDef[]
}

export const StackSchema = {
  type: 'object',
  properties: {
    direction: { type: 'string', enum: ['column', 'row'], title: 'მიმართულება', default: 'column' },
    gap:       { type: 'string', title: 'Gap', default: 'var(--spacing-md)' },
    wrap:      { type: 'boolean', title: 'Wrap', default: false },
  },
} as const

export const StackDefaults: Partial<StackNode> = { direction: 'column' }

export const StackSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'ელემენტები', en: 'Items' },
    multi: true,
  },
}

export const StackGroups: PropertyGroup[] = [
  { label: { ka: 'განლაგება', en: 'Layout' }, fields: ['direction', 'gap', 'wrap'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'stack': StackNode }
}