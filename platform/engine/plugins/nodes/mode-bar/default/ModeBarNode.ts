import type { NodeBase, PropSchema } from '@geostat/react/engine'
import type { ModeId }   from '@geostat/engine'

export interface ModeBarNode extends NodeBase {
  type:  'mode-bar'
  key?:  string
  modes: ModeId[]
}

export const ModeBarSchema: PropSchema = [
  { field: 'modes', type: 'array',  label: 'Mode IDs', required: true },
  { field: 'key',   type: 'string', label: 'Param Key' },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'mode-bar': ModeBarNode }
}