import type { NodeBase, PropertyGroup } from '@statdash/react/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../../schema-contract'

export interface DividerNode extends NodeBase {
  type:     'divider'
  variant?: 'solid' | 'dashed' | 'invisible'
}

export const DividerSchema = defineSchema([
  {
    field:   'variant',
    type:    'string',
    label:   { ka: 'სტილი', en: 'Style' },
    default: 'solid',
    options: [
      { value: 'solid',     label: { ka: 'მთლიანი',     en: 'Solid' } },
      { value: 'dashed',    label: { ka: 'წყვეტილი',    en: 'Dashed' } },
      { value: 'invisible', label: { ka: 'უხილავი',     en: 'Invisible' } },
    ],
  },
])

// FF-SCHEMA-COMPLETE (tier b): divider's only authored prop `variant` is a
// NodeBase key (the registry-variant slot), so EditableKeys resolves to none and
// the assert holds trivially; the schema still authors it via the generic panel.
export type _DividerCovers = Expect<AssertSchemaCovers<DividerNode, typeof DividerSchema>>

export const DividerDefaults: Partial<DividerNode> = { variant: 'solid' }

export const DividerGroups: PropertyGroup[] = [
  { label: { ka: 'სტილი', en: 'Style' }, fields: ['variant'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'divider': DividerNode }
}