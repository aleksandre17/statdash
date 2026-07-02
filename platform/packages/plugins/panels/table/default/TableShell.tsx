import { useState, useEffect }          from 'react'
import { defineShell, useNodeTemplate, useNodeInteractions } from '@statdash/react/engine'
import { usePanelTitleBadge }             from '@statdash/react/engine'
import type { RenderContext }             from '@statdash/react/engine'
import type { BodyStyleAttrs, ViewParams } from '@statdash/react/engine'
import { useInject, EMPTY_STATE, PanelExportBar } from '@statdash/react'
import { splitMultiValue }                from '@statdash/engine'
import type { DataRow, ExportMeta }       from '@statdash/engine'
import type { TableNode }                 from './TableNode'
import DataTable                          from './components/DataTable'

export const TableShell = defineShell<TableNode>({
  render({ def, ctx, vs, merged }) {
    return <TableControl def={def} ctx={ctx} bodyAttrs={vs.body} merged={merged} />
  },
})

function TableControl({
  def, ctx, bodyAttrs, merged,
}: { def: TableNode; ctx: RenderContext; bodyAttrs: BodyStyleAttrs; merged: ViewParams }) {
  const EmptyState = useInject(ctx.ui, EMPTY_STATE)
  const rows = ctx.rows ?? []
  const { type: _, ...tableConfig } = def

  const titleBadge = usePanelTitleBadge(ctx, def, 'table')

  // ── Cross-filter row-select — gated on a declared on[] handler ──────────
  //  A table row is a selection gesture ONLY when the node declares `on`.
  //  Without it the table renders exactly as before (no interactive affordance,
  //  no a11y regression — FF-XF-OPT-OUT / FF-XF-A11Y). The gesture routes through
  //  the SAME shared adapter the chart and map use (one write point).
  const { emit } = useNodeInteractions(def, ctx)
  const selectAction = def.on?.flatMap((h) => h.actions).find((a) => a.type === 'filter')
  const onRowSelect = selectAction
    ? (row: DataRow) => emit('row:click', row as unknown as Record<string, unknown>)
    : undefined
  // The currently-selected id set (for aria-selected + highlight) is the OR-set
  // of the action's target param — the SAME param the click writes (SSOT).
  const selectedIds = selectAction
    ? splitMultiValue(String(ctx.filterParams[selectAction.key] ?? ''))
    : undefined

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

  // merged.label is an i18n carrier — resolve to the active locale for the export meta.
  const title = useNodeTemplate(ctx)(merged.label) ?? ''
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
            <DataTable rows={rows} highlightedLabel={highlightedLabel} onRowSelect={onRowSelect} selectedIds={selectedIds} {...tableConfig} />
            <PanelExportBar ctx={ctx} rows={rows} meta={exportMeta} />
          </>
      }
    </div>
  )
}
