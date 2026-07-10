import type { NodeBase, NodeDef, SlotDef, PropertyGroup } from '@statdash/react/engine'
import type { ResponsiveVal, LayoutAlign }                 from '@statdash/styles'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../../schema-contract'

export interface StackNode extends NodeBase {
  type:       'stack'
  direction?: 'row' | 'column'
  gap?:       ResponsiveVal<string>
  wrap?:      boolean
  /** Cross-axis alignment of the stack items. `stretch` (default) = fill cross-axis. */
  align?:     ResponsiveVal<LayoutAlign>
  children:   NodeDef[]
}

export const StackSchema = defineSchema([
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
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys (children slot excluded).
export type _StackCovers = Expect<AssertSchemaCovers<StackNode, typeof StackSchema>>

export const StackDefaults: Partial<StackNode> = { direction: 'column' }

export const StackSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'ელემენტები', en: 'Items' },
    multi: true,
  },
}

export const StackGroups: PropertyGroup[] = [
  { label: { ka: 'განლაგება', en: 'Layout' }, fields: ['direction', 'gap', 'wrap', 'align'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'stack': StackNode }
}