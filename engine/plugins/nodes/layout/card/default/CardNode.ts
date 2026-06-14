import type { NodeBase, NodeDef, SlotDef } from '@geostat/react/engine'

export interface CardNode extends NodeBase {
  type:      'card'
  children?: NodeDef[]
}

export const CardSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'შიგთავსი', en: 'Content' },
    multi: true,
  },
}

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'card': CardNode }
}