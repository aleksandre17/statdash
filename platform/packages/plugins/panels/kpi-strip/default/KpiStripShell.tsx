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
  // Per-item data-integrity label (localized) handed to each KpiCard — only the
  // methodology-link aria remains card-local now that the preliminary signal is
  // consolidated into the strip-level freshness badge (AR-39). The leaf stays
  // pure/presentational, never hardcoding a language (AR-37 P1).
  const metaLabels = { methodology: t('methodology') }

  // useKpiRows = the async-store-safe KPI read seam (engine). For sync stores it
  // is a memoized interpretKpis; for async stores (caps.sync === false) it warms
  // every requirement the KPIs read — INCLUDING the year-1 comparison period of a
  // 'yoy' — then suspends until warm, so querySync is never cold. NodeErrorBoundary
  // (renderNode) catches a rejected warm.
  const kpis = useKpiRows(def.items, ctx)

  const titleBadge = usePanelTitleBadge(ctx, def, 'kpi-strip')

  if (kpis.length === 0) return <EmptyState />

  // ── Consolidated freshness/integrity signal (AR-39 principle) ─────────────
  //  The strip OR-folds its items' preliminary flags into ONE data-freshness
  //  badge instead of scattering a per-title "P" pill on every card. Same
  //  consolidation as the section's single integrity indicator: one clear
  //  data-freshness signal for the whole strip, not N repeated pills.
  const anyPreliminary = kpis.some(kpi => kpi.preliminary === true)

  return (
    <div className="kpi-strip">
      {(anyPreliminary || titleBadge) && (
        <div className="kpi-strip__meta" aria-live="polite" aria-label={t('status-indicators')}>
          {/* ONE freshness badge (WCAG 2.1 AA / Law 9): not color-only — a dot AND a
              visible localized label. Replaces the former per-card preliminary pills. */}
          {anyPreliminary && (
            <span className="kpi-strip__freshness" title={t('preliminary')}>
              <span className="kpi-strip__freshness-dot" aria-hidden="true" />
              <span className="kpi-strip__freshness-label">{t('preliminary')}</span>
            </span>
          )}
          {titleBadge}
        </div>
      )}
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