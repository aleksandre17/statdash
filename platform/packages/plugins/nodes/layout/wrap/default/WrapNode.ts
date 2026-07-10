import type { NodeBase, NodeDef, SlotDef } from '@statdash/react/engine'
import type { NodeStyles }                 from '@statdash/styles'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../../schema-contract'

// Transparent layout node — distributes styles to all direct children.
// styles = base; child view.styles always override.
// Engine expands wrap in-place (META.transparent = true) — no DOM output.
export interface WrapNode extends NodeBase {
  type:     'wrap'
  styles?:  NodeStyles
  children: NodeDef[]
}

export const WrapSchema = defineSchema([
  { field: 'styles', type: 'object', label: { ka: 'სტილები', en: 'Styles' } },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys (children slot excluded).
// `styles` (NodeStyles) is covered top-level as an opaque object; structured
// per-property authoring is the tier-c backlog.
export type _WrapCovers = Expect<AssertSchemaCovers<WrapNode, typeof WrapSchema>>

export const WrapSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'შვილები', en: 'Children' },
    multi: true,
  },
}

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'wrap': WrapNode }
}