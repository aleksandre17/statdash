import type { NodeBase, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { KpiSpec }                 from '@statdash/engine'

export interface KpiStripNode extends NodeBase {
  type:  'kpi-strip'
  items: KpiSpec[]
}

// ── ITEM-SCHEMA flag (AR-49 / M0 build-item 10) — deferred, deliberately ──────
//  The spec (SPEC-authoring-reconception-M0 §2.3) would make each KPI item's
//  `value.measure` a GOVERNED metric-ref via a NESTED `itemSchema` on this
//  `items` array field. That affordance does NOT exist yet: `PropField` carries
//  no `itemSchema` property (packages/core/config/prop-schema.ts) and no Inspector
//  array item-editor honours a per-item PropSchema. Per the flag's own escape
//  clause, we therefore DO NOT force an inline per-item picker here — the KPI
//  per-item metric-ref lands via the Metric-Palette bind affordance (item 9),
//  which writes the metric-id straight to `items[i].value.measure`. Adding the
//  nested `itemSchema` (a core PropField widen + a panel array-item resolver) is
//  the documented fast-follow; both live OUTSIDE this layer's scope (core +
//  apps/panel), so this schema stays byte-identical for now (additive floor).
export const KpiStripSchema: PropSchema = [
  { field: 'items', type: 'array', label: { ka: 'KPI მეტრიკები', en: 'KPI metrics' }, required: true },
]

export const KpiStripGroups: PropertyGroup[] = [
  { label: { ka: 'მეტრიკები', en: 'Metrics' }, fields: ['items'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'kpi-strip': KpiStripNode }
}