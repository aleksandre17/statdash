import type { NodeBase, NodeDef, SlotDef, PropertyGroup, PropSchema } from '@geostat/react/engine'
import type { ResponsiveVal }                             from '@geostat/styles'

export interface StackNode extends NodeBase {
  type:       'stack'
  direction?: 'row' | 'column'
  gap?:       ResponsiveVal<string>
  wrap?:      boolean
  children:   NodeDef[]
}

export const StackSchema: PropSchema = [
  {
    field:   'direction',
    type:    'string',
    label:   'მიმართულება',
    default: 'column',
    options: [
      { value: 'column', label: 'Column' },
      { value: 'row',    label: 'Row' },
    ],
  },
  { field: 'gap',  type: 'string',  label: 'Gap',  default: 'var(--spacing-md)' },
  { field: 'wrap', type: 'boolean', label: 'Wrap', default: false },
]

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