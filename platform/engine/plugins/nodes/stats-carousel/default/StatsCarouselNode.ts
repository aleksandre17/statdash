import type { NodeBase, PropertyGroup, SlotDef, LocaleString, PropSchema } from '@geostat/react/engine'

export interface StatItem {
  icon?:       string
  iconBg?:     string
  label:       LocaleString
  value:       string
  unit:        string
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

export const StatsCarouselSchema: PropSchema = [
  { field: 'autoplayMs', type: 'number', label: 'ავტოთამაში (ms)', default: 7000 },
  { field: 'slides',     type: 'array',  label: 'სლაიდები',        required: true },
]

export const StatsCarouselDefaults: Partial<StatsCarouselNode> = {
  autoplayMs: 7000,
  slides:     [],
}

export const StatsCarouselSlots: Record<string, SlotDef> = {}

export const StatsCarouselGroups: PropertyGroup[] = [
  { label: { ka: 'ქცევა',    en: 'Behaviour' }, fields: ['autoplayMs'] },
  { label: { ka: 'შიგთავსი', en: 'Content'   }, fields: ['slides']    },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'stats-carousel': StatsCarouselNode }
}