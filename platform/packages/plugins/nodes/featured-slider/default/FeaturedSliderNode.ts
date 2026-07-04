import type { NodeBase, PropertyGroup, SlotDef, PropSchema } from '@statdash/react/engine'
import type { FeaturedItemSpec }                            from '@statdash/engine'

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
}

export const FeaturedSliderSchema: PropSchema = [
  { field: 'autoplayMs', type: 'number', label: { ka: 'ავტოთამაში (ms)', en: 'Autoplay (ms)' }, default: 7000 },
  { field: 'items',      type: 'array',  label: { ka: 'ფიჩერ-ელემენტები', en: 'Featured items' }, required: true },
]

export const FeaturedSliderDefaults: Partial<FeaturedSliderNode> = {
  autoplayMs: 7000,
  items:      [],
}

export const FeaturedSliderSlots: Record<string, SlotDef> = {}

export const FeaturedSliderGroups: PropertyGroup[] = [
  { label: { ka: 'ქცევა',    en: 'Behaviour' }, fields: ['autoplayMs'] },
  { label: { ka: 'შიგთავსი', en: 'Content'   }, fields: ['items']      },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'featured-slider': FeaturedSliderNode }
}
