import type { NodeBase, PropSchema } from '@geostat/react/engine'
import type { LinkDef }  from '@geostat/engine'

export interface LinksNode extends NodeBase {
  type:  'links'
  items: LinkDef[]
}

export const LinksSchema: PropSchema = [
  { field: 'items', type: 'array', label: 'ბმულები', required: true },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'links': LinksNode }
}