import './filter-bar.css'
import { evalWhen }                                          from '@statdash/engine'
import type { BarNode }                                      from '@statdash/engine'
import { filterControlRegistry, useFiltersContext }          from '@statdash/react/engine'
import type { NodeRenderer, RenderContext }                  from '@statdash/react/engine'
import type { FilterBarNode }                               from './FilterBarNode'

export const FilterBarShell: NodeRenderer<FilterBarNode> = (def, ctx, _children) =>
  <FilterBarControl def={def} ctx={ctx} />

function FilterBarControl({ def, ctx }: { def: FilterBarNode; ctx: RenderContext }) {
  const { bars } = useFiltersContext()
  const fp = ctx.filterParams as Record<string, string>

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
            className={`filter-bar filter-bar--${bar.position ?? 'sticky'}`}
            style={{ order: bar.order }}
          >
            {bar.items.map(item => {
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