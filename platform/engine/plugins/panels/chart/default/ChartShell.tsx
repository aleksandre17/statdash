import { useCallback, useMemo }                   from 'react'
import { useNavigate }                             from 'react-router-dom'
import { interpretChart }                          from '@geostat/charts'
import { EmptyState }                              from '@geostat/react/feedback'
import { defineShell }                             from '@geostat/react/engine'
import type { BodyStyleAttrs, RenderContext }       from '@geostat/react/engine'
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
  const { sectionCtx } = ctx
  const legend  = ctx.view?.legend
  const tooltip = ctx.view?.tooltip
  const navigate = useNavigate()

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

  // Gap 8: DataLinks — navigate on chart click
  const handleDataClick = useCallback((dataIndex: number) => {
    if (!def.dataLinks?.length) return
    const row = ctx.rows?.[dataIndex]
    if (!row) return
    const links = ctx.resolveLinks(def.dataLinks, row as unknown as Record<string, import('@geostat/engine').DimVal>)
    if (links.length > 0) {
      const link = links[0]
      if (link.target === 'page' || link.target === 'url') {
        navigate(link.href)
      } else if (link.target === 'external') {
        window.open(link.href, '_blank', 'noopener,noreferrer')
      }
    }
  }, [def.dataLinks, ctx.rows, ctx.resolveLinks, navigate])

  if (!ctx.rows?.length) return <EmptyState />

  return (
    <Chart
      output={output}
      bodyAttrs={bodyAttrs}
      onDataHover={handleDataHover}
      onDataLeave={handleDataLeave}
      onDataClick={def.dataLinks?.length ? handleDataClick : undefined}
    />
  )
}

function viewLegend(l: 'bottom' | 'right' | 'none') {
  return l === 'none' ? { show: false } : { show: true, position: l as 'bottom' | 'right' }
}