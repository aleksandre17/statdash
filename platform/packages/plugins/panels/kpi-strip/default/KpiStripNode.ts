import type { NodeBase, PropertyGroup } from '@statdash/react/engine'
import type { KpiSpec }                 from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface KpiStripNode extends NodeBase {
  type:  'kpi-strip'
  items: KpiSpec[]
}

// ── KpiValueItemSchema — the per-VALUE nested schema (D7.2 / ADR-022) ─────────
//  The M0 payoff: `value.measure` is a GOVERNED metric-ref (enum-ref source
//  'metrics') — the author binds a governed noun, never a raw code (Law 2). The
//  coordinate `filter` (DimFilter) is a free-form dim→value map → OPAQUE by design
//  (acknowledged in OPAQUE_BY_DESIGN). `time` is the literal-year common case of
//  TimeRef. KpiValueSpec is a discriminated union whose only shared key is the
//  system `type`, so this superset schema needs no interface assert (EditableKeys
//  of the union is empty) — it models the point/level fields authors reach for.
export const KpiValueItemSchema = defineSchema([
  { field: 'measure', type: 'enum-ref', source: 'metrics', concern: 'data', label: { ka: 'მეტრიკა', en: 'Metric' } },
  {
    field: 'type', type: 'string', concern: 'data', label: { ka: 'ტიპი', en: 'Type' },
    options: [
      { value: 'point',  label: { ka: 'წერტილი',     en: 'Point'  } },
      { value: 'yoy',    label: { ka: 'წლიური %',    en: 'YoY %'  } },
      { value: 'cagr',   label: { ka: 'CAGR',        en: 'CAGR'   } },
      { value: 'mean',   label: { ka: 'საშუალო',     en: 'Mean'   } },
      { value: 'share',  label: { ka: 'წილი',        en: 'Share'  } },
      { value: 'expr',   label: { ka: 'გამოსახულება', en: 'Expr'   } },
      { value: 'metric', label: { ka: 'გამოთვლილი',   en: 'Metric' } },
    ],
  },
  { field: 'time',   type: 'number', concern: 'data', label: { ka: 'წელი', en: 'Year' } },
  {
    field: 'format', type: 'string', concern: 'style', label: { ka: 'ფორმატი', en: 'Format' },
    // Tenant-NEUTRAL format labels (Law 1 — no tenant currency in a library).
    options: [
      { value: 'mln_gel',  label: { ka: 'მილიონები',      en: 'Millions'    } },
      { value: 'sign_pct', label: { ka: 'ნიშნიანი %',      en: 'Signed %'    } },
      { value: 'pct',      label: { ka: 'პროცენტი',        en: 'Percent'     } },
      { value: 'decimal1', label: { ka: 'ათწილადი (0.0)',  en: 'Decimal 0.0' } },
      { value: 'decimal2', label: { ka: 'ათწილადი (0.00)', en: 'Decimal 0.00'} },
    ],
  },
  // The raw `dim→value` coordinate — a free-form DimFilter. `plane:'system'`: the
  // author binds a GOVERNED metric (`measure`), never a raw dimension coordinate; the
  // coordinate is plumbing behind the metric (root Law 11 · ADR-043).
  { field: 'filter', type: 'object', concern: 'data', label: { ka: 'კოორდინატი (dim→value)', en: 'Coordinate (dim→value)' }, plane: 'system' },
])

// ── KpiItemSchema — the per-KPI nested schema; recurses into `value` ─────────
//  Structured per-item authoring (AR-49 / M0 build-item 10, formerly deferred to
//  the tier-c seam that now exists — ADR-022). The `when` (VisibilityExpr) and
//  `trend` (KpiTrendSpec union) sub-objects stay OPAQUE by design (raw-JSON in the
//  nested editor), acknowledged in OPAQUE_BY_DESIGN.
//  Concern tags (root Law 11): each KPI-item field DECLARES its concern so the drilled
//  band-item inspector groups CONTENT (what it says) · DATA (the governed value ⊕
//  integrity) · STYLE (colour) · BEHAVIOR (conditional visibility) — the exact
//  concern-grouped surface the whole node already has, never a flat re-mush.
export const KpiItemSchema = defineSchema([
  { field: 'label',          type: 'LocaleString', concern: 'content',  label: { ka: 'წარწერა', en: 'Label' }, coverage: 'localized', required: true },
  { field: 'value',          type: 'object',       concern: 'data',     label: { ka: 'მნიშვნელობა', en: 'Value' }, itemSchema: KpiValueItemSchema },
  { field: 'unit',           type: 'LocaleString', concern: 'content',  label: { ka: 'ერთეული', en: 'Unit' }, coverage: 'localized' },
  { field: 'color',          type: 'color',        concern: 'style',    label: { ka: 'ფერი', en: 'Colour' } },
  // Per-item conditional visibility (a VisibilityExpr: op · perspective). `plane:'steward'`:
  // advanced conditional logic behind the steward lens, not author-default (root Law 11).
  { field: 'when',           type: 'object',       concern: 'behavior', label: { ka: 'ხილვადობა', en: 'Visibility' }, plane: 'steward' },
  { field: 'trend',          type: 'object',       concern: 'data',     label: { ka: 'ტრენდი', en: 'Trend' } },
  { field: 'trendSub',       type: 'LocaleString', concern: 'content',  label: { ka: 'ტრენდის წარწერა', en: 'Trend caption' }, coverage: 'localized' },
  { field: 'preliminary',    type: 'boolean',      concern: 'data',     label: { ka: 'წინასწარი', en: 'Preliminary' } },
  { field: 'note',           type: 'string',       concern: 'content',  label: { ka: 'შენიშვნა', en: 'Note' } },
  { field: 'methodologyUrl', type: 'string',       concern: 'content',  label: { ka: 'მეთოდოლოგიის URL', en: 'Methodology URL' } },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with KpiSpec's editable keys (`id`
// excluded as SystemKey).
export type _KpiItemCovers = Expect<AssertSchemaCovers<KpiSpec, typeof KpiItemSchema>>

export const KpiStripSchema = defineSchema([
  {
    field: 'items', type: 'array', label: { ka: 'KPI მეტრიკები', en: 'KPI metrics' }, required: true,
    itemSchema: KpiItemSchema, itemLabel: 'label',
  },
])

// FF-SCHEMA-COMPLETE (tier b): `items` (KpiSpec[]) is now a STRUCTURED nested field
// — the per-item governed metric-ref lands via KpiValueItemSchema.measure.
export type _KpiStripCovers = Expect<AssertSchemaCovers<KpiStripNode, typeof KpiStripSchema>>

export const KpiStripGroups: PropertyGroup[] = [
  { label: { ka: 'მეტრიკები', en: 'Metrics' }, fields: ['items'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'kpi-strip': KpiStripNode }
}