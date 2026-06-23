// Param-driven tabbed content — distinct from TabPageNode (page-level tabs).
// TabsNode: inline tabs driven by a filter param value.
// TabNode:  one content slot inside a TabsNode.
import type { NodeBase, NodeDef, ViewParams } from '@statdash/react/engine'
import type { DataSpec }                      from '@statdash/engine'

export interface TabsNode extends NodeBase {
  type:  'tabs'
  param: string
  items: TabNode[]
}

export interface TabNode extends NodeBase {
  type:     'tab'
  key:      string
  label?:   string
  data?:    DataSpec
  children: NodeDef[]
  view?:    ViewParams
}

declare module '@statdash/react/engine' {
  interface NodeTypeMap {
    'tabs': TabsNode
    'tab':  TabNode
  }
}