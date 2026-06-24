import { defineShell }                              from '@statdash/react/engine'
import { usePanelTitleBadge }                       from '@statdash/react/engine'
import type { BodyStyleAttrs, RenderContext }       from '@statdash/react/engine'
import { useInject, EMPTY_STATE, PanelExportBar }   from '@statdash/react'
import type { ExportMeta }                          from '@statdash/engine'
import type { ChartNode }                           from './ChartNode'
import Chart                                        from './Chart'
import { useChartOutput }                           from './useChartOutput'
import { useChartInteractions }                     from './useChartInteractions'

export const ChartShell = defineShell<ChartNode>({
  render({ def, ctx, vs }) {
    return <ChartControl def={def} ctx={ctx} bodyAttrs={vs.body} />
  },
})

function ChartControl({
  def, ctx, bodyAttrs,
}: { def: ChartNode; ctx: RenderContext; bodyAttrs: BodyStyleAttrs }) {
  const EmptyState   = useInject(ctx.ui, EMPTY_STATE)
  const titleBadge   = usePanelTitleBadge(ctx, def, 'chart')
  const output       = useChartOutput(ctx, def)
  const interactions = useChartInteractions(ctx, def, output)

  if (!ctx.rows?.length) return <EmptyState />

  const rows  = ctx.rows ?? []
  const title = def.label ?? def.view?.label
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
