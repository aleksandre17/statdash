import type { NodeBase, NodeDef, SlotDef, PropertyGroup } from '@statdash/react/engine'
import type { ResponsiveVal, LayoutAlign }                 from '@statdash/styles'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../../schema-contract'

export interface ColumnsNode extends NodeBase {
  type:     'columns'
  count?:   ResponsiveVal<number>
  gap?:     ResponsiveVal<string>
  /** Cross-axis alignment of the columns. `stretch` (default) = equal-height. */
  align?:   ResponsiveVal<LayoutAlign>
  children: NodeDef[]
}

export const ColumnsSchema = defineSchema([
  { field: 'count', type: 'number', label: { ka: 'სვეტები',  en: 'Columns' }, default: 2 },
  { field: 'gap',   type: 'string', label: { ka: 'დაშორება', en: 'Gap' }, default: 'var(--spacing-md)' },
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
export type _ColumnsCovers = Expect<AssertSchemaCovers<ColumnsNode, typeof ColumnsSchema>>

export const ColumnsDefaults: Partial<ColumnsNode> = { count: 2 }

export const ColumnsSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'სვეტები', en: 'Columns' },
    multi: true,
  },
}

export const ColumnsGroups: PropertyGroup[] = [
  { label: { ka: 'განლაგება', en: 'Layout' }, fields: ['count', 'gap', 'align'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'columns': ColumnsNode }
}