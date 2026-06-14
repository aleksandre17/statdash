import { useState, useEffect }  from 'react'
import { EmptyState }            from '@geostat/react/feedback'
import { defineShell }           from '@geostat/react/engine'
import type { RenderContext }    from '@geostat/react/engine'
import type { BodyStyleAttrs }   from '@geostat/react/engine'
import type { TableNode }        from './TableNode'
import DataTable                 from './components/DataTable'

export const TableShell = defineShell<TableNode>({
  render({ def, ctx, vs }) {
    return <TableControl def={def} ctx={ctx} bodyAttrs={vs.body} />
  },
})

function TableControl({
  def, ctx, bodyAttrs,
}: { def: TableNode; ctx: RenderContext; bodyAttrs: BodyStyleAttrs }) {
  const rows = ctx.rows ?? []
  const { type: _, ...tableConfig } = def

  // Gap 6: EventBus — subscribe to row:hover / row:leave to highlight matching rows
  const [highlightedLabel, setHighlightedLabel] = useState<string | undefined>(undefined)

  useEffect(() => {
    const unsubHover = ctx.eventBus.subscribe('row:hover', ({ rowKey }) => {
      setHighlightedLabel(rowKey)
    })
    const unsubLeave = ctx.eventBus.subscribe('row:leave', () => {
      setHighlightedLabel(undefined)
    })
    return () => {
      unsubHover()
      unsubLeave()
    }
  }, [ctx.eventBus])

  return (
    <div {...bodyAttrs}>
      {rows.length === 0
        ? <EmptyState />
        : <DataTable rows={rows} color={ctx.color} highlightedLabel={highlightedLabel} {...tableConfig} />}
    </div>
  )
}