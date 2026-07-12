import { useState, useEffect }          from 'react'
import { defineShell, useNodeTemplate, useNodeInteractions, resolveActionField } from '@statdash/react/engine'
import { SELECTION_WRITE_ACTIONS }        from '@statdash/react/engine'
import { usePanelTitleBadge }             from '@statdash/react/engine'
import type { RenderContext }             from '@statdash/react/engine'
import type { BodyStyleAttrs, ViewParams } from '@statdash/react/engine'
import { useInject, EMPTY_STATE, PanelExport }    from '@statdash/react'
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

  // ── Cross-filter / highlight row-select — gated on a declared on[] handler ──
  //  A table row is a selection gesture ONLY when the node declares `on`.
  //  Without it the table renders exactly as before (no interactive affordance,
  //  no a11y regression — FF-XF-OPT-OUT / FF-XF-A11Y). The gesture routes through
  //  the SAME shared adapter the chart and map use (one write point).
  //
  //  The detected action is ANY selection-write arm — `filter` OR `highlight`
  //  (SELECTION_WRITE_ACTIONS, the SSOT Set the write point folds through). Both
  //  fold a row value into a param via the same applySelection/CommandBus spine;
  //  they differ ONLY downstream — a `filter` param scopes the query (requery), a
  //  `highlight` param is TRANSIENT and read HERE for the selected-row style with
  //  NO requery (linked highlighting, permalink-encoded). Detecting the union
  //  arm — not `filter` alone — is what finally gives a declared `type:'highlight'`
  //  a live render Consumer (AR-42 render-boundary completion; FF-ACTION-ARM-CONSUMED).
  const { emit } = useNodeInteractions(def, ctx)
  // A table row-selection writes a clicked ROW FIELD into a `key` param (filter /
  // highlight). The `drill` selection-write arm has no `key` (it writes a hierarchy
  // level, not a row value) and is not a table row-selection — narrow to the key-bearing
  // arms so `.key` is sound and a drill arm never mis-reads as a row selection.
  const selectAction = def.on?.flatMap((h) => h.actions).find(
    (a): a is Extract<typeof a, { key: unknown }> => SELECTION_WRITE_ACTIONS.has(a.type) && 'key' in a,
  )
  const onRowSelect = selectAction
    ? (row: DataRow) => emit('row:click', row as unknown as Record<string, unknown>)
    : undefined
  // The currently-selected id set (for aria-selected + highlight) is the OR-set
  // of the action's target param — the SAME param the click writes (SSOT). The
  // action key may be a state-bound `{$ctx:_selKey}` ref (AR-38 §4.1); lower it
  // through the SAME one dispatcher the write point uses, so the read never drifts
  // from the write (a bare string resolves to itself — byte-identical).
  const selKey = selectAction
    ? resolveActionField(selectAction.key, { dims: ctx.sectionCtx.dims, vars: ctx.vars })
    : undefined
  const selectedIds = selKey
    ? splitMultiValue(String(ctx.filterParams[selKey] ?? ''))
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
            <PanelExport ctx={ctx} rows={rows} meta={exportMeta} nodeId={def.id} spec={def.data} />
          </>
      }
    </div>
  )
}
