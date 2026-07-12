import { defineShell, useKpiRows, usePanelTitleBadge, PartAnchor } from '@statdash/react/engine'
import type { RenderContext }                    from '@statdash/react/engine'
import { useInject, EMPTY_STATE, useT }         from '@statdash/react'
import { evalVisibility }                        from '@statdash/engine'
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

  // ── ADR-041 · D-F2 — the value band is the SOLE residence ──────────────────
  //  The KPI card is a `value` PartField of the strip's `items` (ADR-041 ROOT-2),
  //  never a promoted node type: the shadow `kpi-card` promotion residence is
  //  RETIRED (D-F2). Per-item visibility — the ONE genuine render-facet promotion
  //  ever carried — stays on THIS value-band render path via each item's declared
  //  `when` (residence-at-field: the value residence owns its own visibility facet),
  //  never a second node residence.
  //
  // Visibility is decided ONCE for layout (count + which cards to lay out) via the
  // SAME `evalVisibility(when, filterParams, perspectiveState)` seam interpretKpis'
  // `kpiVisible` engine SSOT uses — so the visible set is byte-identical to
  // interpretKpis' filtered set (no drift).
  //
  //  Each visible entry keeps its ORIGINAL store index (`def.items[index]`) — the
  //  band path segment the authoring canvas selects on (ADR-041 · PartAnchor).
  //  Pre-filtering here (not relying on useKpiRows' internal filter) is what makes
  //  `kpis[i]` ↔ `visible[i]` ↔ the original index a stable 1:1: interpretKpis
  //  applies the IDENTICAL predicate, so over an already-visible set it is a no-op
  //  that preserves order (the double-filter is idempotent — behaviour-preserving).
  const visible = def.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      !item.when || evalVisibility(item.when, ctx.filterParams, ctx.sectionCtx.perspectiveState))
  const visibleItems = visible.map(v => v.item)

  // useKpiRows = the async-store-safe KPI read seam (engine). For sync stores it
  // is a memoized interpretKpis; for async stores (caps.sync === false) it warms
  // every requirement the KPIs read — INCLUDING the year-1 comparison period of a
  // 'yoy' — then suspends until warm, so querySync is never cold. NodeErrorBoundary
  // (renderNode) catches a rejected warm. Feeds the wrapper (count + preliminary
  // fold) and the per-item <KpiCard> maps of the value band.
  const kpis = useKpiRows(visibleItems, ctx)

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
        {/* The value band is the SOLE residence (ADR-041 D-F2). The strip owns the
            KpiSpec[] value band and maps each visible item to <KpiCard>. Each card is
            wrapped in the GENERIC PartAnchor keyed by its ORIGINAL store index (the
            value-band `(field, index)` coordinate), so the authoring canvas can frame +
            select it as a bounded part (ADR-041 · the ONE anchor). Off the canvas the
            anchor is a zero-DOM Fragment, so this markup is byte-identical to the live
            site. */}
        {kpis.map((kpi, i) => (
          <PartAnchor key={visible[i]!.item.id ?? kpi.label} field="items" index={visible[i]!.index}>
            <KpiCard {...kpi} trendLabels={trendLabels} metaLabels={metaLabels} />
          </PartAnchor>
        ))}
      </div>
    </div>
  )
}