import { useState, useEffect }          from 'react'
import { defineShell }                    from '@statdash/react/engine'
import { usePanelTitleBadge }             from '@statdash/react/engine'
import type { RenderContext }             from '@statdash/react/engine'
import type { BodyStyleAttrs }            from '@statdash/react/engine'
import { useInject, EMPTY_STATE, PanelExportBar } from '@statdash/react'
import type { ExportMeta }                from '@statdash/engine'
import type { TableNode }                 from './TableNode'
import DataTable                          from './components/DataTable'

export const TableShell = defineShell<TableNode>({
  render({ def, ctx, vs }) {
    return <TableControl def={def} ctx={ctx} bodyAttrs={vs.body} />
  },
})

function TableControl({
  def, ctx, bodyAttrs,
}: { def: TableNode; ctx: RenderContext; bodyAttrs: BodyStyleAttrs }) {
  const EmptyState = useInject(ctx.ui, EMPTY_STATE)
  const rows = ctx.rows ?? []
  const { type: _, ...tableConfig } = def

  const titleBadge = usePanelTitleBadge(ctx, def, 'table')

  // EventBus — subscribe to row:hover / row:leave so this table highlights the
  // row a sibling panel (e.g. a chart) is currently pointing at.
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

  const title = def.view?.label
  const exportMeta: ExportMeta = {
    title,
    filename: def.id ?? title,
  }

  return (
    <div {...bodyAttrs}>
      {titleBadge && (
        <div className="table__title-badges" aria-live="polite">
          {titleBadge}
        </div>
      )}
      {rows.length === 0
        ? <EmptyState />
        : <>
            <DataTable rows={rows} highlightedLabel={highlightedLabel} {...tableConfig} />
            <PanelExportBar ctx={ctx} rows={rows} meta={exportMeta} />
          </>
      }
    </div>
  )
}
