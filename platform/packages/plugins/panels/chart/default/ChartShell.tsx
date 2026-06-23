import { Fragment, useCallback, useMemo }          from 'react'
import { interpretChart }                          from '@statdash/charts'
import { defineShell, resolvePreliminary }         from '@statdash/react/engine'
import type { BodyStyleAttrs, RenderContext }       from '@statdash/react/engine'
import { useInject, EMPTY_STATE, EXPORT_BAR, useExtensions, PANEL_TITLE_BADGE } from '@statdash/react'
import type { ExportMeta }                         from '@statdash/engine'
import type { ChartNode }                          from './ChartNode'
import Chart                                       from './Chart'

export const ChartShell = defineShell<ChartNode>({
  render({ def, ctx, vs }) {
    return <ChartControl def={def} ctx={ctx} bodyAttrs={vs.body} />
  },
})

function ChartControl({
  def, ctx, bodyAttrs,
}: { def: ChartNode; ctx: RenderContext; bodyAttrs: BodyStyleAttrs }) {
  const EmptyState = useInject(ctx.ui, EMPTY_STATE)
  const ExportBar  = useInject(ctx.ui, EXPORT_BAR)
  const { sectionCtx } = ctx
  const legend  = ctx.view?.legend
  const tooltip = ctx.view?.tooltip

  const titleBadges = useExtensions(ctx.extensions, PANEL_TITLE_BADGE, {
    nodeType:    'chart',
    nodeId:      def.id,
    preliminary: resolvePreliminary(def, ctx),
  })
  const titleBadge = titleBadges.length > 0
    ? <>{titleBadges.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>
    : undefined

  // Gap 5: fieldConfig cascade — parent ctx.fieldConfig as base, node def as override
  const defFc = def.fieldConfig
  const fieldConfig = useMemo(
    () => (ctx.fieldConfig || defFc) ? { ...ctx.fieldConfig, ...defFc } : undefined,
    [ctx.fieldConfig, defFc],
  )

  const output = useMemo(() => {
    const rows = ctx.rows ?? []
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type: _type, chartType, fieldConfig: _fc, ...chartDefFields } = def
    return interpretChart(
      {
        type: chartType,
        ...chartDefFields,
        ...(fieldConfig != null ? { fieldConfig } : {}),
        ...(legend  != null ? { legend:  viewLegend(legend)  } : {}),
        ...(tooltip != null ? { tooltip: { mode: tooltip }   } : {}),
      },
      rows,
      sectionCtx,
    )
  }, [def, fieldConfig, legend, tooltip, ctx.rows, sectionCtx])

  // Gap 6: EventBus — publish row:hover / row:leave on chart data point events
  const handleDataHover = useCallback((dataIndex: number) => {
    const rowKey = output.categories[dataIndex] ?? String(dataIndex)
    ctx.eventBus.publish('row:hover', { rowKey, nodeType: 'chart' })
  }, [ctx.eventBus, output.categories])

  const handleDataLeave = useCallback(() => {
    ctx.eventBus.publish('row:leave', { nodeType: 'chart' })
  }, [ctx.eventBus])

  // Gap 8: DataLinks — navigate on chart click via CommandBus (nav:drill)
  const handleDataClick = useCallback((dataIndex: number) => {
    if (!def.dataLinks?.length) return
    const row = ctx.rows?.[dataIndex]
    if (!row) return
    const links = ctx.resolveLinks(def.dataLinks, row as unknown as Record<string, import('@statdash/engine').DimVal>)
    if (links.length > 0) {
      const link = links[0]
      if (link.action === 'navigate') {
        ctx.bus.dispatch({ type: 'nav:drill', href: link.href, target: link.target ?? 'page' })
      }
    }
  }, [def.dataLinks, ctx.rows, ctx.resolveLinks, ctx.bus])

  if (!ctx.rows?.length) return <EmptyState />

  const rows = ctx.rows ?? []
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
        onDataHover={handleDataHover}
        onDataLeave={handleDataLeave}
        onDataClick={def.dataLinks?.length ? handleDataClick : undefined}
      />
      <ExportBar
        rows={rows}
        meta={exportMeta}
        onExport={fmt => ctx.bus.dispatch({ type: 'data:export', format: fmt, rows, meta: exportMeta })}
      />
    </>
  )
}

function viewLegend(l: 'bottom' | 'right' | 'none') {
  return l === 'none' ? { show: false } : { show: true, position: l as 'bottom' | 'right' }
}