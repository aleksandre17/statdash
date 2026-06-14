import type { NodeBase } from '@geostat/react/engine'
import type { LinkDef }  from '@geostat/engine'

export interface LinksNode extends NodeBase {
  type:  'links'
  items: LinkDef[]
}

export const LinksSchema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: { type: 'array', title: 'ბმულები' },
  },
} as const

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'links': LinksNode }
}