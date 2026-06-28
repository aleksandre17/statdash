import type { NodeBase, PropSchema } from '@statdash/react/engine'
import type { LinkDef }  from '@statdash/engine'

export interface LinksNode extends NodeBase {
  type:  'links'
  items: LinkDef[]
}

export const LinksSchema: PropSchema = [
  { field: 'items', type: 'array', label: { ka: 'ბმულები', en: 'Links' }, required: true },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'links': LinksNode }
}