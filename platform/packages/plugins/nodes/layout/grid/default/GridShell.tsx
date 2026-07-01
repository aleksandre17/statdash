import { resolveAlign, resolveGrid }                  from '@statdash/styles'
import { defineShell, LayoutItemProvider }           from '@statdash/react/engine'
import type { NodeBase }                             from '@statdash/react/engine'
import type { GridNode }                             from './GridNode'

// Pure interpreter: resolveGrid(def) → { style, data } (the full grid-template
// grammar, per-breakpoint). The shell SPREADS and never inspects (§12). Each
// child rides LayoutItemProvider so per-child colSpan/rowSpan/order placement
// (view.styles) resolves against THIS grid — the dead-until-now grid power.
export const GridShell = defineShell<GridNode>({
  render({ def, children }) {
    const { style, data } = resolveGrid(def)
    const align   = resolveAlign(def.align)
    const justify = resolveAlign(def.justify)

    return (
      <div className="layout-grid-ctx">
        <div className="layout-grid" data-align={align} data-justify={justify} {...data} style={style}>
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
