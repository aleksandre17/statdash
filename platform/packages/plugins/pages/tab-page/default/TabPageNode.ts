import type { NodeBase, NodeDef, SlotDef } from '@statdash/react/engine'

export interface TabPageNode extends NodeBase {
  type:        'tab-page'
  defaultTab?: number
  children:    NodeDef[]
}

export const TabPageSlots: Record<string, SlotDef> = {
  children: {
    field: 'children',
    label: { ka: 'ჩანართები', en: 'Tabs' },
    multi: true,
  },
}

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'tab-page': TabPageNode }
}