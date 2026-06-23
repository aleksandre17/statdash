import { defineShell }   from '../../engine'
import type { NodeBase } from '../../engine'

// Default shell is a no-op — register a concrete TableShell from plugins/.
export const DefaultTableShell = defineShell<NodeBase>({
  render: () => null,
})