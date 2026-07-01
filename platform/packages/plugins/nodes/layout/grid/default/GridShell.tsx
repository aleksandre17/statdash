import { applyContainerVars, resolveAlign }          from '@statdash/styles'
import { defineShell, LayoutItemProvider }           from '@statdash/react/engine'
import type { NodeBase }                             from '@statdash/react/engine'
import type { GridNode }                             from './GridNode'

export const GridShell = defineShell<GridNode>({
  render({ def, children }) {
    const gapVars = applyContainerVars(def.gap)
    const align   = resolveAlign(def.align)

    return (
      <div className="layout-grid-ctx">
        <div className="layout-grid" data-align={align} style={gapVars}>
          {children.defs.map((d, i) => (
            <LayoutItemProvider key={i} styles={(d as NodeBase).view?.styles}>
              {children.rendered[i]}
            </LayoutItemProvider>
          ))}
        </div>
      </div>
    )
  },
})