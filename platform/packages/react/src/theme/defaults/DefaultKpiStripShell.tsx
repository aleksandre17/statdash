import { defineShell }   from '../../engine'
import type { NodeBase } from '../../engine'

// Default shell is a no-op — register a concrete KpiStripShell from plugins/.
export const DefaultKpiStripShell = defineShell<NodeBase>({
  render: () => null,
})