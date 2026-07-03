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
  // Per-item methodology-link aria (localized) handed to each KpiCard. The
  // preliminary signal is now consolidated to ONE page-level indicator (AR-40);
  // the leaf stays pure/presentational, never hardcoding a language (AR-37 P1).
  const metaLabels = { methodology: t('methodology') }

  // useKpiRows = the async-store-safe KPI read seam (engine). For sync stores it
  // is a memoized interpretKpis; for async stores (caps.sync === false) it warms
  // every requirement the KPIs read — INCLUDING the year-1 comparison period of a
  // 'yoy' — then suspends until warm, so querySync is never cold. NodeErrorBoundary
  // (renderNode) catches a rejected warm.
  const kpis = useKpiRows(def.items, ctx)

  // ── AR-40 — publish the strip's TRUE preliminary truth to the page scope ───
  //  A kpi-strip's integrity is a FOLD over its per-item flags (kpi.preliminary =
  //  spec.preliminary || provenance 'p'), which the generic resolvePreliminary(def)
  //  can't see (the strip has no single measure / ctx.rows). So the strip passes
  //  its own fold as the override — the page header then folds it into the ONE
  //  consolidated indicator. `|| undefined` defers to the generic resolver when the
  //  strip itself sees nothing preliminary.
  const anyPreliminary = kpis.some(kpi => kpi.preliminary === true)
  const titleBadge = usePanelTitleBadge(ctx, def, 'kpi-strip', anyPreliminary || undefined)

  if (kpis.length === 0) return <EmptyState />

  return (
    <div className="kpi-strip">
      {/* Any PANEL_TITLE_BADGE contribution (extension seam) renders here; the
          preliminary signal itself is published UP to the page-level indicator,
          not shown as a per-strip badge (AR-40). */}
      {titleBadge && <div className="kpi-strip__meta">{titleBadge}</div>}
      {/* Count-aware grid: the strip is the query container, the grid responds to
          the strip's own inline-size and resolves to a clean column count that
          DIVIDES the KPI count at every width (no stranded orphan). data-kpi-count
          is pure data passthrough — the column ladder lives in kpi.css (Law 2). */}
      <div className="kpi-strip__grid" data-kpi-count={String(kpis.length)}>
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} trendLabels={trendLabels} metaLabels={metaLabels} />)}
      </div>
    </div>
  )
}