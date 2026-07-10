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

export const FeaturedSliderSchema = defineSchema([
  { field: 'autoplayMs',       type: 'number',  label: { ka: 'ავტოთამაში (ms)', en: 'Autoplay (ms)' }, default: 7000 },
  { field: 'preliminaryBadge', type: 'boolean', label: { ka: 'წინასწარი ნიშანი', en: 'Preliminary badge' }, default: true },
  { field: 'items',            type: 'array',   label: { ka: 'ფიჩერ-ელემენტები', en: 'Featured items' }, required: true },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys. `items` (FeaturedItemSpec[])
// is covered top-level; per-item metric-ref authoring is the tier-c backlog.
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
