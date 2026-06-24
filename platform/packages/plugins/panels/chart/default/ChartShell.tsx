import { defineShell }                              from '@statdash/react/engine'
import { usePanelTitleBadge }                       from '@statdash/react/engine'
import type { BodyStyleAttrs, RenderContext, ViewParams } from '@statdash/react/engine'
import { useInject, EMPTY_STATE, PanelExportBar }   from '@statdash/react'
import type { ExportMeta }                          from '@statdash/engine'
import type { ChartNode }                           from './ChartNode'
import Chart                                        from './Chart'
import { useChartOutput }                           from './useChartOutput'
import { useChartInteractions }                     from './useChartInteractions'

export const ChartShell = defineShell<ChartNode>({
  render({ def, ctx, vs, merged }) {
    return <ChartControl def={def} ctx={ctx} bodyAttrs={vs.body} merged={merged} />
  },
})

function ChartControl({
  def, ctx, bodyAttrs, merged,
}: { def: ChartNode; ctx: RenderContext; bodyAttrs: BodyStyleAttrs; merged: ViewParams }) {
  const EmptyState   = useInject(ctx.ui, EMPTY_STATE)
  const titleBadge   = usePanelTitleBadge(ctx, def, 'chart')
  const output       = useChartOutput(ctx, def)
  const interactions = useChartInteractions(ctx, def, output)

  if (!ctx.rows?.length) return <EmptyState />

  const rows  = ctx.rows ?? []
  // def.label is the chart's own header (ChartDef), then the view-level label
  // (read off `merged`, never `def.view` raw — defineShell contract).
  const title = def.label ?? merged.label
  const exportMeta: ExportMeta = {
    title,
    filename: def.id ?? title,
  }

  return (
    <>
      {titleBadge && (
        <div className="chart__title-badges" aria-live="polite">
          {titleBadge}
        </div>
      )}
      <Chart
        output={output}
        bodyAttrs={bodyAttrs}
        onDataHover={interactions.onDataHover}
        onDataLeave={interactions.onDataLeave}
        onDataClick={interactions.onDataClick}
      />
      <PanelExportBar ctx={ctx} rows={rows} meta={exportMeta} />
    </>
  )
}
