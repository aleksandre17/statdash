import type { NodeBase, PropertyGroup, SlotDef, LocaleString } from '@statdash/react/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface StatItem {
  icon?:       string
  iconBg?:     string
  label:       LocaleString
  value:       string
  unit:        LocaleString
  change?:     number
  changeText?: LocaleString
}

export interface StatSlide {
  tab:   LocaleString
  title: LocaleString
  stats: StatItem[]
}

export interface StatsCarouselNode extends NodeBase {
  type:        'stats-carousel'
  slides:      StatSlide[]
  autoplayMs?: number
}

export const StatsCarouselSchema = defineSchema([
  { field: 'autoplayMs', type: 'number', label: { ka: 'ავტოთამაში (ms)', en: 'Autoplay (ms)' }, default: 7000 },
  { field: 'slides',     type: 'array',  label: { ka: 'სლაიდები',        en: 'Slides' }, required: true },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys. `slides` (StatSlide[]) is
// covered top-level; per-item authoring is the tier-c backlog.
export type _StatsCarouselCovers = Expect<AssertSchemaCovers<StatsCarouselNode, typeof StatsCarouselSchema>>

export const StatsCarouselDefaults: Partial<StatsCarouselNode> = {
  autoplayMs: 7000,
  slides:     [],
}

export const StatsCarouselSlots: Record<string, SlotDef> = {}

export const StatsCarouselGroups: PropertyGroup[] = [
  { label: { ka: 'ქცევა',    en: 'Behaviour' }, fields: ['autoplayMs'] },
  { label: { ka: 'შიგთავსი', en: 'Content'   }, fields: ['slides']    },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'stats-carousel': StatsCarouselNode }
}