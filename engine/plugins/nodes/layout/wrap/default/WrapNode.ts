import type { NodeBase, NodeDef, SlotDef } from '@geostat/react/engine'
import type { NodeStyles }                 from '@geostat/styles'

// Transparent layout node — distributes styles to all direct children.
// styles = base; child view.styles always override.
// Engine expands wrap in-place (META.transparent = true) — no DOM output.
export interface WrapNode extends NodeBase {
  type:     'wrap'
  styles?:  NodeStyles
  children: NodeDef[]
}

export const WrapSchema = {
  type: 'object',
  properties: {
    styles: { type: 'object', title: 'სტილები' },
  },
} as const

export const WrapSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'შვილები', en: 'Children' },
    multi: true,
  },
}

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'wrap': WrapNode }
}