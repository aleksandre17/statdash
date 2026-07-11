// ── kpiSpecToCardNode — the KpiSpec ⇄ kpi-card promotion lowering (ADR-023 · R2) ─
//
//  The Promotion Law (§3.3) verdict: a KpiSpec carries ≥2 node facets
//  (id + `when` visibility + own value data + per-card `color`) → it graduates to
//  a first-class `kpi-card` NODE. This module is the pure, total map between the
//  legacy value-band shape (`KpiSpec`, nested in `KpiStripNode.items[]`) and the
//  promoted tree-band shape (`KpiCardNode`, a leaf that flows through renderNode).
//
//  It is KPI-specific and therefore lives in the PLUGIN, never the engine — the
//  renderNode pipeline stays generic (Law 1: no hardcoded 'kpi' in the engine; the
//  promoted type registers like any other node type, OCP).
//
//  FACET RESIDENCE (the lift):
//    • `id`   → NodeBase.id                    (identity is a node facet)
//    • `when` → view.visibleWhen               (visibility is a node facet — the
//               SAME VisibilityExpr, gated by renderNode step 0.5 via the SAME
//               `evalVisibility(expr, filterParams, perspectiveState)` seam
//               `kpiVisible` uses → byte-identical visibility)
//    • the display/value payload (label, value, unit, color, trend, trendSub,
//      preliminary, note, methodologyUrl) → top-level card props (interpretKpi
//      reads them verbatim — lossless).
//
//  Round-trip TOTAL: `cardNodeToKpiSpec(kpiSpecToCardNode(spec))` reproduces `spec`
//  (the strip's stored `items[]` shape is UNTOUCHED — the lowering is render-time
//  only, so Law-2 round-trip of the stored config is preserved by construction).
//
import type { KpiSpec }     from '@statdash/engine'
import type { KpiCardNode } from './KpiCardNode'

/** Lower a legacy value-band `KpiSpec` to the promoted `kpi-card` node (render-time). */
export function kpiSpecToCardNode(spec: KpiSpec): KpiCardNode {
  const { id, when, label, value, unit, color, trend, trendSub, preliminary, note, methodologyUrl } = spec
  return {
    type: 'kpi-card',
    id,
    // Visibility is a NODE facet — lift `when` onto `view.visibleWhen` so the card
    // self-gates through renderNode's engine-level visibility gate (step 0.5),
    // retiring the private `kpiVisible` seam for the promoted residence.
    ...(when ? { view: { visibleWhen: when } } : {}),
    label,
    value,
    ...(unit           !== undefined ? { unit }           : {}),
    color,
    ...(trend          !== undefined ? { trend }          : {}),
    ...(trendSub       !== undefined ? { trendSub }       : {}),
    ...(preliminary    !== undefined ? { preliminary }    : {}),
    ...(note           !== undefined ? { note }           : {}),
    ...(methodologyUrl !== undefined ? { methodologyUrl } : {}),
  }
}

/**
 * Recover the `KpiSpec` a `kpi-card` node carries, for the interpreter seam
 * (interpretKpi / useKpiRows). `when` is intentionally NOT restored: the promoted
 * card's visibility already lives on `view.visibleWhen` and is gated by renderNode
 * BEFORE the shell runs, so the reconstructed spec is unconditionally visible to
 * `interpretKpis` (no double-gating, no drift).
 */
export function cardNodeToKpiSpec(node: KpiCardNode): KpiSpec {
  const { id, label, value, unit, color, trend, trendSub, preliminary, note, methodologyUrl } = node
  return {
    id: id ?? '',
    label,
    value,
    ...(unit           !== undefined ? { unit }           : {}),
    color,
    ...(trend          !== undefined ? { trend }          : {}),
    ...(trendSub       !== undefined ? { trendSub }       : {}),
    ...(preliminary    !== undefined ? { preliminary }    : {}),
    ...(note           !== undefined ? { note }           : {}),
    ...(methodologyUrl !== undefined ? { methodologyUrl } : {}),
  }
}
