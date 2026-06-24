import { defineShell }     from '../../engine'
import type { NodeBase }   from '../../engine'

// Generic pass-through fallback for an UNREGISTERED node type — renders its
// children verbatim and owns no node-specific markup. This is NOT section code:
// the real section shell lives in plugins/nodes/section/default/SectionShell.tsx.
// (No-Privileged-Node ADR: de-privileged from the misnamed DefaultSectionShell.)
export const DefaultPassthroughShell = defineShell<NodeBase>({
  render({ children }) {
    return <>{children.rendered}</>
  },
})
