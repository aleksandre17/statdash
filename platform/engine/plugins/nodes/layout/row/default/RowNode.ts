import type { NodeBase, NodeDef, ViewParams, SlotDef } from '@geostat/react/engine'

export interface RowNode extends NodeBase {
  type:  'row'
  items: NodeDef[]
  view?: Pick<ViewParams, 'visibleWhen' | 'cols'>
}

export const RowSchema = {
  type: 'object',
  properties: {
    'view.cols': { type: ['string', 'number'], title: 'სვეტების რაოდენობა' },
  },
} as const

export const RowDefaults: Partial<RowNode> = {}

export const RowSlots: Record<string, SlotDef> = {
  items: {
    field: 'items',
    label: { ka: 'სვეტები', en: 'Columns' },
    multi: true,
  },
}

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'row': RowNode }
}