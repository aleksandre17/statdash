import type { NodeBase, NodeDef, ViewParams, SlotDef, PropSchema } from '@statdash/react/engine'

export interface RowNode extends NodeBase {
  type:  'row'
  items: NodeDef[]
  view?: Pick<ViewParams, 'visibleWhen' | 'cols'>
}

export const RowSchema: PropSchema = [
  { field: 'view.cols', type: 'string', label: { ka: 'სვეტების რაოდენობა', en: 'Column count' } },
]

export const RowDefaults: Partial<RowNode> = {}

export const RowSlots: Record<string, SlotDef> = {
  items: {
    field: 'items',
    label: { ka: 'სვეტები', en: 'Columns' },
    multi: true,
  },
}

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'row': RowNode }
}