import type { NodeBase, NodeDef, SlotDef } from '@statdash/react/engine'

export interface ContainerPageNode extends NodeBase {
  type:     'container-page'
  variant?: string
  children: NodeDef[]
}

export const ContainerPageSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'შიგთავსი', en: 'Content' },
    multi: true,
  },
}

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'container-page': ContainerPageNode }
}