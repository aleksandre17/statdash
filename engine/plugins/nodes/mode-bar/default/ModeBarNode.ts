import type { NodeBase } from '@geostat/react/engine'
import type { ModeId }   from '@geostat/engine'

export interface ModeBarNode extends NodeBase {
  type:  'mode-bar'
  key?:  string
  modes: ModeId[]
}

export const ModeBarSchema = {
  type: 'object',
  required: ['modes'],
  properties: {
    modes: { type: 'array',  title: 'Mode IDs' },
    key:   { type: 'string', title: 'Param Key' },
  },
} as const

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'mode-bar': ModeBarNode }
}