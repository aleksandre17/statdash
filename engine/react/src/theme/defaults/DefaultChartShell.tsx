import { defineShell }   from '../../engine'
import type { NodeBase } from '../../engine'

// Default shell is a no-op — register a concrete ChartShell from plugins/.
export const DefaultChartShell = defineShell<NodeBase>({
  render: () => null,
})