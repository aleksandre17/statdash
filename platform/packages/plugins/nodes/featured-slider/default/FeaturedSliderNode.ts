import type { NodeBase, PropertyGroup, SlotDef } from '@statdash/react/engine'
import type { FeaturedItemSpec }                            from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

/**
 * featured-slider — a DATA-BOUND headline carousel (AR-40, first consumer of the
 * semantic layer). Unlike `stats-carousel` (a `caps:[]` editorial node whose
 * StatItem.value is a hand-typed string), every item here is a `FeaturedItemSpec`
 * — a metric-id + coordinate resolved to the LIVE governed value through the KPI
 * seam (interpretKpi). A new headline = a new item (Law 8, Constructor-ready).
 *
 * Items are grouped into tabbed slides by their `group`; each slide auto-advances.
 */
export interface FeaturedSliderNode extends NodeBase {
  type:        'featured-slider'
  /** Curated headline items (metric-ref + coordinate). Pure data — no literals. */
  items:       FeaturedItemSpec[]
  /** Auto-advance dwell (ms). Omitted ⇒ engine default; 0 ⇒ no autoplay. */
  autoplayMs?: number
  /**
   * Show the preliminary "P" badge on a card whose datum is preliminary (Law 9
   * data-integrity). DEFAULT true — omitting it preserves the badge for every
   * tenant. Set false only to suppress the badge on SUMMARY featured cards where
   * the authoritative page-level preliminary indicator carries the integrity note.
   */
  preliminaryBadge?: boolean
}

// ── FeaturedItemSchema — the per-ITEM nested schema (D7.2 / ADR-022) ─────────
//  Each item is a governed CURATION: a metric-ref (enum-ref source 'metrics' — the
//  author picks a GOVERNED noun, never a raw code, Law 2 / AR-40) read at a pinned
//  coordinate. The scalar curation-overrides (label/unit/format/href/…) model
//  cleanly; the coordinate `at` (DimFilter map) and `trend` (KpiTrendSpec union) stay
//  OPAQUE by design — free-form dim→value map / discriminated union — and are
//  acknowledged in OPAQUE_BY_DESIGN (schema-completeness.fitness §1c). `time` is the
//  literal-year common case of TimeRef (a `{$ctx}` pin is authored as raw when needed).
export const FeaturedItemSchema = defineSchema([
  { field: 'metric',   type: 'enum-ref',     source: 'metrics', label: { ka: 'მეტრიკა', en: 'Metric' }, required: true },
  { field: 'label',    type: 'LocaleString', label: { ka: 'წარწერა (override)', en: 'Label (override)' }, coverage: 'localized' },
  { field: 'unit',     type: 'LocaleString', label: { ka: 'ერთეული (override)', en: 'Unit (override)' }, coverage: 'localized' },
  {
    field: 'format', type: 'string', label: { ka: 'ფორმატი', en: 'Format' },
    // Tenant-NEUTRAL format labels (Law 1 — no tenant currency in a library): they
    // describe the numeric shape, not any currency. The `value` is the engine
    // FormatKey vocabulary (mln_gel = "millions" magnitude).
    options: [
      { value: 'mln_gel',  label: { ka: 'მილიონები',      en: 'Millions'    } },
      { value: 'sign_pct', label: { ka: 'ნიშნიანი %',      en: 'Signed %'    } },
      { value: 'pct',      label: { ka: 'პროცენტი',        en: 'Percent'     } },
      { value: 'decimal1', label: { ka: 'ათწილადი (0.0)',  en: 'Decimal 0.0' } },
      { value: 'decimal2', label: { ka: 'ათწილადი (0.00)', en: 'Decimal 0.00'} },
    ],
  },
  { field: 'href',     type: 'LocaleString', label: { ka: 'ბმული (slug/URL)', en: 'Link (slug/URL)' }, required: true },
  { field: 'group',    type: 'LocaleString', label: { ka: 'ჯგუფი (ტაბი)', en: 'Group (tab)' }, coverage: 'localized' },
  { field: 'icon',     type: 'icon',         label: { ka: 'ხატულა', en: 'Icon' } },
  { field: 'order',    type: 'number',       label: { ka: 'რიგი', en: 'Order' } },
  { field: 'color',    type: 'color',        label: { ka: 'აქცენტის ფერი', en: 'Accent colour' } },
  { field: 'trendSub', type: 'LocaleString', label: { ka: 'ტრენდის წარწერა', en: 'Trend caption' }, coverage: 'localized' },
  { field: 'time',     type: 'number',       label: { ka: 'წელი', en: 'Year' } },
  { field: 'at',       type: 'object',       label: { ka: 'კოორდინატი (dim→value)', en: 'Coordinate (dim→value)' } },
  { field: 'trend',    type: 'object',       label: { ka: 'ტრენდი', en: 'Trend' } },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with FeaturedItemSpec's editable keys.
export type _FeaturedItemCovers = Expect<AssertSchemaCovers<FeaturedItemSpec, typeof FeaturedItemSchema>>

export const FeaturedSliderSchema = defineSchema([
  { field: 'autoplayMs',       type: 'number',  label: { ka: 'ავტოთამაში (ms)', en: 'Autoplay (ms)' }, default: 7000 },
  { field: 'preliminaryBadge', type: 'boolean', label: { ka: 'წინასწარი ნიშანი', en: 'Preliminary badge' }, default: true },
  {
    field: 'items', type: 'array', label: { ka: 'ფიჩერ-ელემენტები', en: 'Featured items' }, required: true,
    itemSchema: FeaturedItemSchema, itemLabel: 'label',
  },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys. `items` (FeaturedItemSpec[])
// is now a STRUCTURED nested field — per-item metric-ref authoring lands here.
export type _FeaturedSliderCovers = Expect<AssertSchemaCovers<FeaturedSliderNode, typeof FeaturedSliderSchema>>

export const FeaturedSliderDefaults: Partial<FeaturedSliderNode> = {
  autoplayMs:       7000,
  preliminaryBadge: true,
  items:            [],
}

export const FeaturedSliderSlots: Record<string, SlotDef> = {}

export const FeaturedSliderGroups: PropertyGroup[] = [
  { label: { ka: 'ქცევა',    en: 'Behaviour' }, fields: ['autoplayMs', 'preliminaryBadge'] },
  { label: { ka: 'შიგთავსი', en: 'Content'   }, fields: ['items']      },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'featured-slider': FeaturedSliderNode }
}
