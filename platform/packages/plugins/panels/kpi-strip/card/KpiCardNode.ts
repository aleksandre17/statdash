import type { NodeBase, PropertyGroup } from '@statdash/react/engine'
import type { KpiValueSpec, KpiTrendSpec, LocaleString } from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'
import { KpiValueItemSchema } from '../default/KpiStripNode'

// ── KpiCardNode — the PROMOTED first-class kpi card (ADR-023 · R2 expand) ─────
//
//  The Promotion Law graduated the legacy value-band `KpiSpec` (nested in
//  `KpiStripNode.items[]`) to this first-class NODE. It carries its own node
//  facets and flows through the WHOLE renderNode pipeline (RBAC, engine-level
//  visibility gate, per-node ErrorBoundary/Suspense, middleware) for free — the
//  private `interpretKpi` mini-pipeline is strangled for the promoted residence.
//
//  RESIDENCE OF EACH FACET (vs the legacy KpiSpec):
//    • `id`      → NodeBase.id             (identity)
//    • `when`    → NodeBase.view.visibleWhen  (visibility — gated by renderNode)
//    • the value/display payload           → the top-level props below
//  The value is a `KpiValueSpec` (point/yoy/cagr/mean/share/expr/metric) resolved
//  by the SAME `interpretKpi` seam the strip uses (routed into the pipeline via the
//  card shell), so the promoted render is byte-identical to the legacy one.
//
export interface KpiCardNode extends NodeBase {
  type:            'kpi-card'
  /** User-facing card label (LocaleString — resolved + template-expanded by interpretKpi). */
  label:           LocaleString
  /** What to compute — the KPI value algebra (point/yoy/cagr/mean/share/expr/metric). */
  value:           KpiValueSpec
  /** Optional unit suffix (absent for a self-describing percent value). */
  unit?:           LocaleString
  /** Per-card accent colour (→ the KpiCard `--kc` var). */
  color:           string
  /** Optional trend line (yoy/cagr/share/static). */
  trend?:          KpiTrendSpec
  /** Caption under the trend line (LocaleString; template-expanded). */
  trendSub?:       LocaleString
  /** Mark the value preliminary / subject to revision (IMF/Eurostat "P"). */
  preliminary?:    boolean
  /** Short explanatory note below the trend line. */
  note?:           string
  /** Methodology / metadata URL — renders as the card's info-icon link. */
  methodologyUrl?: string
}

// ── KpiCardSchema — the card's OWN property schema (Constructor Inspector) ─────
//  1:1 with KpiItemSchema MINUS `when`: the promoted card's visibility is a node
//  facet (`view.visibleWhen`, authored via the shared view/visibility editor),
//  never a value-band field — so it does NOT appear here (this is precisely the
//  facet-reinvention the Promotion Law removes: FF-NO-FACET-REINVENTION flips to a
//  hard gate once the legacy KpiItemSchema retires at R2-contract).
export const KpiCardSchema = defineSchema([
  { field: 'label',          type: 'LocaleString', label: { ka: 'წარწერა', en: 'Label' }, coverage: 'localized', required: true },
  { field: 'value',          type: 'object',       label: { ka: 'მნიშვნელობა', en: 'Value' }, itemSchema: KpiValueItemSchema },
  { field: 'unit',           type: 'LocaleString', label: { ka: 'ერთეული', en: 'Unit' }, coverage: 'localized' },
  { field: 'color',          type: 'color',        label: { ka: 'ფერი', en: 'Colour' } },
  { field: 'trend',          type: 'object',       label: { ka: 'ტრენდი', en: 'Trend' } },
  { field: 'trendSub',       type: 'LocaleString', label: { ka: 'ტრენდის წარწერა', en: 'Trend caption' }, coverage: 'localized' },
  { field: 'preliminary',    type: 'boolean',      label: { ka: 'წინასწარი', en: 'Preliminary' } },
  { field: 'note',           type: 'string',       label: { ka: 'შენიშვნა', en: 'Note' } },
  { field: 'methodologyUrl', type: 'string',       label: { ka: 'მეთოდოლოგიის URL', en: 'Methodology URL' } },
])

// FF-SCHEMA-COMPLETE: the card's PropSchema stays 1:1 with its editable keys
// (`id` excluded as SystemKey; `when` now lives on `view.visibleWhen`, a node facet).
export type _KpiCardCovers = Expect<AssertSchemaCovers<KpiCardNode, typeof KpiCardSchema>>

export const KpiCardGroups: PropertyGroup[] = [
  { label: { ka: 'მეტრიკა', en: 'Metric' }, fields: ['label', 'value', 'unit', 'color'] },
  { label: { ka: 'ტრენდი', en: 'Trend' }, fields: ['trend', 'trendSub', 'note', 'methodologyUrl', 'preliminary'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'kpi-card': KpiCardNode }
}
