import './filter-bar.css'
import { evalWhen, evalVisibility }                          from '@statdash/engine'
import type { BarNode }                                      from '@statdash/engine'
import { filterControlRegistry, useFiltersContext }          from '@statdash/react/engine'
import type { NodeRenderer, RenderContext }                  from '@statdash/react/engine'
import type { FilterBarNode }                               from './FilterBarNode'

export const FilterBarShell: NodeRenderer<FilterBarNode> = (def, ctx, _children) =>
  <FilterBarControl def={def} ctx={ctx} />

function FilterBarControl({ def, ctx }: { def: FilterBarNode; ctx: RenderContext }) {
  const { bars } = useFiltersContext()
  const fp = ctx.filterParams as Record<string, string>
  // Active perspective ids — the SAME SSOT renderNode reads for node `visibleWhen`
  // (ctx.sectionCtx.perspectiveState). Threaded here so a filter ITEM can be scoped
  // to a perspective (e.g. year-selector only in `year`, from/to only in `range`)
  // via the canonical `perspective-is` op — render-only, never default resolution.
  const perspectiveState = ctx.sectionCtx.perspectiveState

  const visible = def.barIds
    ? bars.filter((b: BarNode) => def.barIds!.includes(b.id ?? ''))
    : bars

  if (visible.length === 0) return null

  return (
    <>
      {visible.map((bar: BarNode, i: number) => {
        if (bar.showWhen && !evalWhen(bar.showWhen, fp)) return null
        return (
          <div
            key={bar.id ?? i}
            className="filter-bar"
            data-position={bar.position ?? 'sticky'}
            style={{ order: bar.order }}
          >
            {bar.items.map(item => {
              // Perspective-scoped item visibility [P5.1] — render-only gate, mirrors
              // node `view.visibleWhen`. Skip the control when its expr is false against
              // the active perspectiveState. Default resolution is UNAFFECTED (it gates
              // on the P4.5 ownership seam in useFilterState).
              if (item.visibleWhen && !evalVisibility(item.visibleWhen, fp, perspectiveState))
                return null
              const slice = filterControlRegistry.get(item.type)
              if (!slice) return null
              return (
                <slice.Shell
                  key={item.key}
                  filterKey={item.key}
                  config={item}
                />
              )
            })}
          </div>
        )
      })}
    </>
  )
}