import type { NodeBase, NodeDef, SlotDef, PropSchema } from '@statdash/react/engine'
import type { NodeStyles }                 from '@statdash/styles'

// Transparent layout node — distributes styles to all direct children.
// styles = base; child view.styles always override.
// Engine expands wrap in-place (META.transparent = true) — no DOM output.
export interface WrapNode extends NodeBase {
  type:     'wrap'
  styles?:  NodeStyles
  children: NodeDef[]
}

export const WrapSchema: PropSchema = [
  { field: 'styles', type: 'object', label: 'სტილები' },
]

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