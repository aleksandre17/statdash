import type { NodeBase, NodeDef, SlotDef, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { ResponsiveVal }                             from '@statdash/styles'

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
    label:   { ka: 'მიმართულება', en: 'Direction' },
    default: 'column',
    options: [
      { value: 'column', label: { ka: 'სვეტი', en: 'Column' } },
      { value: 'row',    label: { ka: 'მწკრივი', en: 'Row' } },
    ],
  },
  { field: 'gap',  type: 'string',  label: { ka: 'დაშორება', en: 'Gap' },     default: 'var(--spacing-md)' },
  { field: 'wrap', type: 'boolean', label: { ka: 'გადატანა',  en: 'Wrap' },    default: false },
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

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'stack': StackNode }
}