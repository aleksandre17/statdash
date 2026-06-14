import type { CSSProperties }                         from 'react'
import { applyContainerVars }                        from '@geostat/styles'
import { defineShell, LayoutItemProvider }           from '@geostat/react/engine'
import type { NodeBase }                             from '@geostat/react/engine'
import type { StackNode }                            from './StackNode'

export const StackShell = defineShell<StackNode>({
  render({ def, children }) {
    const gapVars = applyContainerVars(def.gap)
    const wrap    = def.wrap ? { '--stack-wrap': 'wrap' } as CSSProperties : undefined
    const style   = (gapVars || wrap) ? { ...gapVars, ...wrap } as CSSProperties : undefined

    return (
      <div className="layout-stack" data-dir={def.direction ?? 'column'} style={style}>
        {children.defs.map((d, i) => (
          <LayoutItemProvider key={i} styles={(d as NodeBase).view?.styles}>
            {children.rendered[i]}
          </LayoutItemProvider>
        ))}
      </div>
    )
  },
})