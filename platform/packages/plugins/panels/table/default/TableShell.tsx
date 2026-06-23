import { Fragment, useState, useEffect } from 'react'
import { defineShell, resolvePreliminary } from '@statdash/react/engine'
import type { RenderContext }           from '@statdash/react/engine'
import type { BodyStyleAttrs }          from '@statdash/react/engine'
import { useInject, EMPTY_STATE, EXPORT_BAR, useExtensions, PANEL_TITLE_BADGE } from '@statdash/react'
import type { ExportMeta }             from '@statdash/engine'
import type { TableNode }              from './TableNode'
import DataTable                       from './components/DataTable'

export const TableShell = defineShell<TableNode>({
  render({ def, ctx, vs }) {
    return <TableControl def={def} ctx={ctx} bodyAttrs={vs.body} />
  },
})

function TableControl({
  def, ctx, bodyAttrs,
}: { def: TableNode; ctx: RenderContext; bodyAttrs: BodyStyleAttrs }) {
  const EmptyState = useInject(ctx.ui, EMPTY_STATE)
  const ExportBar  = useInject(ctx.ui, EXPORT_BAR)
  const rows = ctx.rows ?? []
  const { type: _, ...tableConfig } = def

  const titleBadges = useExtensions(ctx.extensions, PANEL_TITLE_BADGE, {
    nodeType:    'table',
    nodeId:      def.id,
    preliminary: resolvePreliminary(def, ctx),
  })
  const titleBadge = titleBadges.length > 0
    ? <>{titleBadges.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>
    : undefined

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
            <ExportBar
              rows={rows}
              meta={exportMeta}
              onExport={fmt => ctx.bus.dispatch({ type: 'data:export', format: fmt, rows, meta: exportMeta })}
            />
          </>
      }
    </div>
  )
}