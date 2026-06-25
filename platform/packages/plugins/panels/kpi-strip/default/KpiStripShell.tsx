import { defineShell, useKpiRows, usePanelTitleBadge } from '@statdash/react/engine'
import type { RenderContext }                  from '@statdash/react/engine'
import { useInject, EMPTY_STATE, useT }         from '@statdash/react'
import type { KpiStripNode }                   from './KpiStripNode'
import KpiCard                                  from './components/KpiCard'

export const KpiStripShell = defineShell<KpiStripNode>({
  render({ def, ctx }) {
    return <KpiStripControl def={def} ctx={ctx} />
  },
})

function KpiStripControl({ def, ctx }: { def: KpiStripNode; ctx: RenderContext }) {
  const EmptyState = useInject(ctx.ui, EMPTY_STATE)
  const t          = useT('kpi-strip')
  const trendLabels = { up: t('trend-up'), down: t('trend-down'), flat: t('trend-flat') }

  // useKpiRows = the async-store-safe KPI read seam (engine). For sync stores it
  // is a memoized interpretKpis; for async stores (caps.sync === false) it warms
  // every requirement the KPIs read — INCLUDING the year-1 comparison period of a
  // 'yoy' — then suspends until warm, so querySync is never cold. NodeErrorBoundary
  // (renderNode) catches a rejected warm.
  const kpis = useKpiRows(def.items, ctx)

  const titleBadge = usePanelTitleBadge(ctx, def, 'kpi-strip')

  if (kpis.length === 0) return <EmptyState />

  return (
    <>
      {titleBadge && (
        <div className="kpi-strip__title-badges" aria-live="polite" aria-label="Data status indicators">
          {titleBadge}
        </div>
      )}
      <div className="kpi-strip">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} trendLabels={trendLabels} />)}
      </div>
    </>
  )
}