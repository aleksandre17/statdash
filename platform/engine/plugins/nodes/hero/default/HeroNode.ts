import type { NodeBase, PropertyGroup, SlotDef, LocaleString } from '@geostat/react/engine'

export interface HeroCardDef {
  id:     string
  title:  LocaleString
  sub?:   LocaleString
  color:  string
  img:    string
  pageBg: string
}

export interface HeroNode extends NodeBase {
  type:      'hero'
  title:     LocaleString
  subtitle?: LocaleString
  cards:     HeroCardDef[]
}

export const HeroSchema = {
  type: 'object',
  required: ['title', 'cards'],
  properties: {
    title:    { type: ['string', 'object'], title: 'სათაური' },
    subtitle: { type: ['string', 'object'], title: 'ქვესათაური' },
    cards: {
      type:  'array',
      title: 'ბარათები',
      items: {
        type: 'object',
        required: ['id', 'title', 'color', 'img', 'pageBg'],
        properties: {
          id:     { type: 'string',              title: 'ID' },
          title:  { type: ['string', 'object'],  title: 'სათაური' },
          sub:    { type: ['string', 'object'],  title: 'ქვეტექსტი' },
          color:  { type: 'string',              title: 'ბეჯის ფერი' },
          img:    { type: 'string',              title: 'სურათი (URL)' },
          pageBg: { type: 'string',              title: 'გვერდის ფონი (gradient)' },
        },
      },
    },
  },
} as const

export const HeroDefaults: Partial<HeroNode> = {
  title:    { ka: '', en: '' },
  subtitle: { ka: '', en: '' },
  cards:    [],
}

export const HeroSlots: Record<string, SlotDef> = {}

export const HeroGroups: PropertyGroup[] = [
  { label: { ka: 'შიგთავსი', en: 'Content' }, fields: ['title', 'subtitle', 'cards'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'hero': HeroNode }
}