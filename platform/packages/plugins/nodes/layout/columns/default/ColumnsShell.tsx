import { resolveColumns, applyContainerVars }        from '@statdash/styles'
import { defineShell, LayoutItemProvider }           from '@statdash/react/engine'
import type { NodeBase }                             from '@statdash/react/engine'
import type { ColumnsNode }                          from './ColumnsNode'

export const ColumnsShell = defineShell<ColumnsNode>({
  render({ def, children }) {
    const cols    = resolveColumns(def.count)
    const gapVars = applyContainerVars(def.gap)

    return (
      <div className="layout-cols-ctx">
        <div
          className="layout-columns"
          data-cols={cols.default}
          data-cols-xl={cols.xl}
          data-cols-lg={cols.lg}
          data-cols-md={cols.md}
          data-cols-sm={cols.sm}
          data-cols-xs={cols.xs}
          style={gapVars}
        >
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