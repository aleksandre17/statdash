import { applyContainerVars }                        from '@geostat/styles'
import { defineShell, LayoutItemProvider }           from '@geostat/react/engine'
import type { NodeBase }                             from '@geostat/react/engine'
import type { GridNode }                             from './GridNode'

export const GridShell = defineShell<GridNode>({
  render({ def, children }) {
    const gapVars = applyContainerVars(def.gap)

    return (
      <div className="layout-grid-ctx">
        <div className="layout-grid" style={gapVars}>
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