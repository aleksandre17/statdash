import { defineShell }     from '../../engine'
import type { NodeBase }   from '../../engine'

// Default shell passes children through — register a concrete SectionShell from plugins/.
export const DefaultSectionShell = defineShell<NodeBase>({
  render({ children }) {
    return <>{children.rendered}</>
  },
})