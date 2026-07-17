// ── FF-KPI-STRIP-NO-DATA-FACET — WORK-0083 root-cause regression guard ─────────
//
//  ROOT CAUSE (proven, e2e/probes/probe-0081-replica.mjs + probe-click-param.mjs):
//  a kpi-strip has NO `data: DataSpec` field in its own contract (KpiStripSchema =
//  `items: KpiSpec[]` only) and its shell never reads `ctx.rows` — it reads the
//  store through interpretKpis, an entirely separate surface (KpiStripShell.tsx).
//  The panel's Inspector Data facet (DataFacetField/MetricPalette) is opt-in via
//  the `data-bindable` cap (packages/plugins/CLAUDE.md / builtinFacets.ts). A
//  kpi-strip that (wrongly) declares `data-bindable` exposes a bind UI whose write
//  lands on the generic `node.data` field the shell never reads — but the engine's
//  generic `effectiveStoreKey` (renderNode.ts) DOES walk ANY node's `.data` to
//  route `ctx.pageStoreKey`, so that stray write silently rerouted the WHOLE
//  strip's store (all sibling items, each still carrying their own correct raw
//  measure code) to the bound metric's dataSource — 0 rows, honest "no
//  observation for this coordinate" on every card, independent of boot path.
//
//  This is a permanent regression gate on the DECLARATION, not the mechanism
//  (Law 6 — root cause, not symptom): a kpi-strip must never re-acquire
//  `data-bindable` until its shell/schema genuinely gain a top-level `data` field
//  it reads rows from. The correct, existing per-item bind surface is each item's
//  OWN governed `value.measure` (KpiValueItemSchema, `enum-ref`/`metrics`),
//  authored through the per-item Inspector drill (ADR-041 value-band Part
//  grammar) — never a node-level `data` facet.
//
import { describe, it, expect } from 'vitest'
import { META } from './meta'
import { KpiStripSchema } from './KpiStripNode'

describe('FF-KPI-STRIP-NO-DATA-FACET — kpi-strip never re-declares data-bindable', () => {
  it('META.caps does not include data-bindable', () => {
    expect(META.caps).not.toContain('data-bindable')
  })

  it('the top-level schema declares no data-pipeline / data field (items only)', () => {
    const topFields = KpiStripSchema.map((f) => f.field)
    expect(topFields).toEqual(['items'])
    expect(topFields).not.toContain('data')
  })
})
