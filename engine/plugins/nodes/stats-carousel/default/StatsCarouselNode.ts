import type { NodeBase, PropertyGroup, SlotDef, LocaleString } from '@geostat/react/engine'

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

export const StatsCarouselSchema = {
  type: 'object',
  required: ['slides'],
  properties: {
    autoplayMs: { type: 'number', title: 'ავტოთამაში (ms)', default: 7000 },
    slides: {
      type:  'array',
      title: 'სლაიდები',
      items: {
        type: 'object',
        required: ['tab', 'title', 'stats'],
        properties: {
          tab:   { type: ['string', 'object'], title: 'ჩანართი' },
          title: { type: ['string', 'object'], title: 'სათაური' },
          stats: {
            type:  'array',
            title: 'ინდიკატორები',
            items: {
              type: 'object',
              required: ['label', 'value', 'unit'],
              properties: {
                icon:       { type: 'string',             title: 'ემოჯი / სიმბოლო' },
                iconBg:     { type: 'string',             title: 'იკონის ფონი'      },
                label:      { type: ['string', 'object'], title: 'ეტიკეტი'          },
                value:      { type: 'string',             title: 'მნიშვნელობა'      },
                unit:       { type: 'string',             title: 'ერთეული'          },
                change:     { type: 'number',             title: 'ცვლილება (%)'     },
                changeText: { type: ['string', 'object'], title: 'ცვლილების ტექსტი' },
              },
            },
          },
        },
      },
    },
  },
} as const

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