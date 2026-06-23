import { Fragment }                             from 'react'
import { useFiltersContext }                     from '../../context/FiltersContext'
import type { FilterBarNode, RenderContext, NodeRenderer } from '../../engine/types'

export const DefaultFilterBarShell: NodeRenderer<FilterBarNode> = (def, ctx, _children) =>
  <DefaultFilterBarControl def={def} ctx={ctx} />

function DefaultFilterBarControl({ def, ctx }: { def: FilterBarNode; ctx: RenderContext }) {
  const { bars } = useFiltersContext()

  const visible = def.barIds
    ? bars.filter(b => def.barIds!.includes(b.id ?? ''))
    : bars

  if (visible.length === 0) return null

  return (
    <>
      {visible.map((bar, i) => (
        <Fragment key={bar.id ?? i}>
          {ctx.renderNode(bar)}
        </Fragment>
      ))}
    </>
  )
}