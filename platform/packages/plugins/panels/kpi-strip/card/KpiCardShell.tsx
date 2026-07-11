import { defineShell, useKpiRows } from '@statdash/react/engine'
import type { RenderContext }      from '@statdash/react/engine'
import { useT }                    from '@statdash/react'
import type { KpiCardNode }        from './KpiCardNode'
import { cardNodeToKpiSpec }       from './kpiSpecToCardNode'
import KpiCard                     from '../default/components/KpiCard'

// ── KpiCardShell — the PROMOTED card's renderer (ADR-023 · R2 expand) ─────────
//
//  Routes the legacy `interpretKpi` LOWERING into the renderNode pipeline: the
//  card node reconstructs its `KpiSpec` and reads it through the SAME async-safe
//  `useKpiRows` seam the strip uses (Cache-Aside warm-then-read for async stores,
//  a memoized `interpretKpis` for sync stores) — so the resolved KpiDef and the
//  emitted `<KpiCard>` DOM are BYTE-IDENTICAL to the legacy strip render.
//
//  Visibility is NOT re-checked here: `when` was lifted to `view.visibleWhen`, so
//  renderNode's engine-level gate (step 0.5) already decided visibility BEFORE this
//  shell runs — the reconstructed spec is unconditionally visible to interpretKpis
//  (no double-gating, no drift). Trend/aria labels resolve through the SHARED
//  `kpi-strip` i18n namespace (the card is part of the strip plugin family), so the
//  strings match the legacy render exactly.
//
export const KpiCardShell = defineShell<KpiCardNode>({
  render({ def, ctx }) {
    return <KpiCardControl def={def} ctx={ctx} />
  },
})

function KpiCardControl({ def, ctx }: { def: KpiCardNode; ctx: RenderContext }) {
  const t           = useT('kpi-strip')
  const trendLabels = { up: t('trend-up'), down: t('trend-down'), flat: t('trend-flat') }
  const metaLabels  = { methodology: t('methodology') }

  // One-item read through the strip's own resolution seam — identical resolution,
  // identical KpiDef. A single visible card ⇒ exactly one resolved entry.
  const [kpi] = useKpiRows([cardNodeToKpiSpec(def)], ctx)
  if (!kpi) return null

  return <KpiCard {...kpi} trendLabels={trendLabels} metaLabels={metaLabels} />
}
