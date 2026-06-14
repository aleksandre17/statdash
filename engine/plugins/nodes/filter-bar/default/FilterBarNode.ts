// FilterBarNode, BarNode, ParamNode originate in @geostat/engine.
// This file augments NodeTypeMap so engine-originated filter nodes are
// part of the typed NodeDef union via the same declare module pattern.
import type { FilterBarNode, BarNode, ParamNode } from '@geostat/engine'

export type { FilterBarNode, BarNode, ParamNode }

declare module '@geostat/react/engine' {
  interface NodeTypeMap {
    'filter-bar': FilterBarNode
    'bar':        BarNode
    'param':      ParamNode
  }
}